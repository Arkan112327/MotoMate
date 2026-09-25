const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed'
        });
    }

    try {
        const { message, motorcycle, maintenance } = req.body || {};

        if (!message) {
            return res.status(400).json({
                error: 'Message is required'
            });
        }

        const model = genAI.getGenerativeModel({
            model: process.env.GEMINI_MODEL || 'gemini-1.5-flash'
        });

        const prompt = `
You are MotoMate, a practical motorcycle assistant.

Answer in Indonesian.
Use the supplied data.
Do not invent motorcycle specifications or maintenance facts.
Give safe and actionable advice.

Motorcycle:
${JSON.stringify(motorcycle)}

Maintenance:
${JSON.stringify(maintenance)}

User:
${message}
`;

        const result = await model.generateContent(prompt);

        return res.status(200).json({
            reply: result.response.text()
        });

    } catch (error) {
        console.error('Gemini error:', error);

        return res.status(500).json({
            error: 'Gemini request failed'
        });
    }
};
