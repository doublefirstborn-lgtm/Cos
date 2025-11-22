import axios from "axios";
import FormData from "form-data";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const { audioUrl, language = "auto" } = req.body;

    if (!audioUrl) {
      return res.status(400).json({ error: "audioUrl is required" });
    }

    // Check if URL seems like a webpage (YouTube, TikTok, Instagram)
    const lowerUrl = audioUrl.toLowerCase();
    if (
      lowerUrl.includes("youtube.com") ||
      lowerUrl.includes("youtu.be") ||
      lowerUrl.includes("tiktok.com") ||
      lowerUrl.includes("instagram.com")
    ) {
      return res.status(400).json({
        error: "Please provide a direct audio/video file URL (.mp3, .wav, .m4a). YouTube/TikTok/Instagram links are not supported directly."
      });
    }

    // Step 1 — Download audio/video as arraybuffer
    let fileResponse;
    try {
      fileResponse = await axios.get(audioUrl, {
        responseType: "arraybuffer",
        validateStatus: null,
      });

      if (fileResponse.status !== 200) {
        return res.status(400).json({
          error: `Failed to fetch file. Status code: ${fileResponse.status}`
        });
      }

      const contentType = fileResponse.headers["content-type"];
      if (!contentType.startsWith("audio") && !contentType.startsWith("video")) {
        return res.status(400).json({
          error: `URL does not point to an audio/video file. Content-Type: ${contentType}`
        });
      }
    } catch (err) {
      return res.status(500).json({ error: "Failed to download file: " + err.message });
    }

    // Step 2 — Prepare Whisper API form-data
    const form = new FormData();
    form.append("file", fileResponse.data, {
      filename: "audiofile.mp3",
      contentType: fileResponse.headers["content-type"] || "audio/mpeg"
    });
    form.append("model", "whisper-1");
    if (language !== "auto") form.append("language", language);

    // Step 3 — Call OpenAI Whisper
    const whisperResponse = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        maxContentLength: 500 * 1024 * 1024
      }
    );

    res.status(200).json({
      transcript: whisperResponse.data.text
    });

  } catch (err) {
    console.error("Transcription error:", err.response?.data || err.message);
    res.status(500).json({
      error: err.response?.data?.error?.message || err.message || "Transcription failed"
    });
  }
}
