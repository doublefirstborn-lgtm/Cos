import axios from "axios";
import FormData from "form-data";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const { audioUrl, language = "auto" } = req.body;

    if (!audioUrl)
      return res.status(400).json({ error: "audioUrl is required" });

    // Step 1 — Download audio/video as stream
    const fileResponse = await axios.get(audioUrl, { responseType: "arraybuffer" });

    // Step 2 — Prepare Whisper API form-data
    const form = new FormData();
    form.append("file", fileResponse.data, {
      filename: "audiofile.mp3",
      contentType: "audio/mpeg"
    });
    form.append("model", "whisper-1");
    if (language !== "auto") form.append("language", language);

    // Step 3 — Call Whisper
    const whisperResponse = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );

    res.status(200).json({
      transcript: whisperResponse.data.text
    });

  } catch (err) {
    console.error("Transcription error:", err.response?.data || err.message);
    res.status(500).json({
      error: err.response?.data?.error?.message || err.message
    });
  }
}
