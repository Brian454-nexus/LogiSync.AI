# LogiSync.AI Environment Configuration

## 🔑 Setting up OpenAI API Key

To run LogiSync.AI with full AI capabilities, you need to set your OpenAI API key as an environment variable.

### Windows (PowerShell)
```powershell
$env:OPENAI_API_KEY="your-openai-api-key-here"
python app.py
```

### Windows (Command Prompt)
```cmd
set OPENAI_API_KEY=your-openai-api-key-here
python app.py
```

### Linux/Mac
```bash
export OPENAI_API_KEY="your-openai-api-key-here"
python app.py
```

## 🚀 Quick Start

1. **Set the environment variable** using one of the methods above
2. **Run the app**: `python app.py`
3. **Open browser**: `http://localhost:5000`
4. **Test AI features**: Upload images for OCR, test ML predictions, chat with AI

## 🔒 Security Note

The API key is now stored as an environment variable, not hardcoded in the source code. This prevents it from being exposed in version control.

## 🤖 AI Features Available

- **GPT-4 Vision OCR**: Upload images for real AI extraction
- **ML ETA Prediction**: Random Forest Regressor for arrival times
- **ML Anomaly Detection**: Isolation Forest for unusual patterns
- **ML Fraud Detection**: Isolation Forest for fraud prevention
- **GPT-4 Translation**: English ↔ Swahili with cultural context
- **GPT-4 Chat**: Intelligent logistics conversations

## 🌍 African Logistics Focus

Designed specifically for African supply chains with:
- Multilingual support (English/Swahili)
- Cultural awareness in translations
- Border crossing optimization
- Weather and traffic integration
- Sharp-edged, professional design
