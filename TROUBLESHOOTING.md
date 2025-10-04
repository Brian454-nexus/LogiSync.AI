# LogiSync.AI - Troubleshooting Guide

## 🔧 **Common Issues & Solutions**

### **OpenAI API Error (Fixed)**
**Error**: `You tried to access openai.ChatCompletion, but this is no longer supported in openai>=1.0.0`

**Solution**: ✅ **FIXED** - Updated to use new OpenAI API format:
```python
# Old format (deprecated)
response = openai.ChatCompletion.create(...)

# New format (current)
client = openai.OpenAI(api_key=openai.api_key)
response = client.chat.completions.create(...)
```

### **Environment Variable Setup**
**Issue**: API key not working

**Solution**:
1. Set environment variable:
   ```powershell
   $env:OPENAI_API_KEY="your-openai-api-key-here"
   ```

2. Restart the app:
   ```bash
   python app.py
   ```

### **Port Already in Use**
**Error**: `Address already in use`

**Solution**:
1. Kill existing process:
   ```bash
   # Find process using port 5000
   netstat -ano | findstr :5000
   # Kill the process (replace PID)
   taskkill /PID <PID> /F
   ```

2. Or use different port:
   ```python
   app.run(debug=True, host='0.0.0.0', port=5001)
   ```

### **Missing Dependencies**
**Error**: `ModuleNotFoundError`

**Solution**:
```bash
pip install -r requirements.txt
```

### **ML Models Not Loading**
**Error**: Models not found

**Solution**: Models are created automatically on first run. If issues persist:
1. Delete `models/` folder
2. Restart app - models will be recreated

## 🚀 **Quick Start Checklist**

### **Before Demo**
- [ ] Environment variable set: `$env:OPENAI_API_KEY="your-key"`
- [ ] App running: `python app.py`
- [ ] Browser open: `http://localhost:5000`
- [ ] Test AI Chat: Ask "Track truck KBA-234D"
- [ ] Test data input: Add SMS update
- [ ] Test tracking: Enter "KBA-234D"

### **Demo Features Working**
- [ ] Dashboard shows active shipments
- [ ] Data Sources tab shows fragmented data
- [ ] Add Data tab accepts SMS/QR/receipts
- [ ] Track Shipment shows unified data
- [ ] AI Chat responds in English/Swahili

## 🎯 **Demo Backup Plan**

### **If AI Chat Fails**
- Use pre-written responses
- Show the data unification features
- Focus on the logistics problem solving

### **If OCR Fails**
- Use sample data
- Show the concept with mock results
- Explain the AI processing

### **If App Crashes**
- Restart: `python app.py`
- Use static demo data
- Focus on the problem/solution narrative

## 🔧 **Technical Details**

### **API Endpoints**
- `GET /api/shipments` - All unified shipments
- `GET /api/track/<truck_id>` - Track specific truck
- `GET /api/data-sources` - Raw fragmented data
- `POST /api/add-sms` - Add SMS update
- `POST /api/add-qr-scan` - Add QR scan
- `POST /api/ocr` - Process receipt image
- `GET /api/predict-eta/<truck_id>` - Get ETA prediction
- `POST /api/chat` - AI chat assistant

### **Data Flow**
1. **Fragmented Input** → SMS, QR, receipts, manual
2. **AI Processing** → OCR, parsing, unification
3. **Unified Output** → Single dashboard view
4. **AI Predictions** → ETA, anomalies, insights

## 🏆 **Success Indicators**

### **Working Correctly**
- ✅ Dashboard shows unified shipments
- ✅ Data Sources shows fragmented data
- ✅ Add Data accepts multiple input types
- ✅ Track Shipment shows unified timeline
- ✅ AI Chat responds intelligently
- ✅ All features work without errors

### **Ready for Demo**
- ✅ App loads without errors
- ✅ All tabs functional
- ✅ AI features working
- ✅ Sample data loaded
- ✅ Professional design displayed

---

**If you encounter any issues, the app is designed to work gracefully with fallback data and error handling. Focus on the core value proposition: unified logistics data! 🚀**
