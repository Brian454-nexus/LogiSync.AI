from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import openai
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor, IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
import joblib
import os
from datetime import datetime, timedelta
import json
import requests
from werkzeug.utils import secure_filename
import base64
from PIL import Image
import io
import re
import random

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configure OpenAI
openai.api_key = os.getenv('OPENAI_API_KEY', 'your-openai-api-key-here')
print(f"🔑 OpenAI API Key loaded: {openai.api_key[:20]}..." if openai.api_key != 'your-openai-api-key-here' else "❌ Using placeholder API key")

# Global variables for ML models
eta_model = None
anomaly_model = None
fraud_model = None
scaler = StandardScaler()

class LogiSyncAI:
    def __init__(self):
        self.shipments = {}
        self.data_sources = {
            'carrier_logs': [],
            'customs_records': [],
            'warehouse_receipts': [],
            'sms_updates': [],
            'qr_scans': []
        }
        self.unified_data = {}
        self.load_models()
        self.generate_sample_data()
    
    def load_models(self):
        """Load or create ML models"""
        global eta_model, anomaly_model, fraud_model
        
        try:
            eta_model = joblib.load('models/eta_model.pkl')
            anomaly_model = joblib.load('models/anomaly_model.pkl')
            fraud_model = joblib.load('models/fraud_model.pkl')
            print("✅ Models loaded successfully")
        except:
            print("🔄 Creating new models...")
            self.create_models()
    
    def create_models(self):
        """Create and train ML models"""
        global eta_model, anomaly_model, fraud_model
        
        # Generate synthetic training data
        np.random.seed(42)
        n_samples = 1000
        
        # ETA prediction features
        distances = np.random.normal(400, 100, n_samples)
        weather_delays = np.random.exponential(0.5, n_samples)
        traffic_delays = np.random.exponential(0.3, n_samples)
        border_delays = np.random.exponential(0.4, n_samples)
        
        # Calculate ETA (base time + delays)
        base_time = distances / 60  # 60 km/h average speed
        total_delays = weather_delays + traffic_delays + border_delays
        eta_hours = base_time + total_delays
        
        # Features for ETA model
        X_eta = np.column_stack([distances, weather_delays, traffic_delays, border_delays])
        y_eta = eta_hours
        
        # Train ETA model
        eta_model = RandomForestRegressor(n_estimators=100, random_state=42)
        eta_model.fit(X_eta, y_eta)
        
        # Anomaly detection features
        route_deviations = np.random.normal(0, 1, n_samples)
        time_deviations = np.random.normal(0, 1, n_samples)
        weight_deviations = np.random.normal(0, 1, n_samples)
        
        X_anomaly = np.column_stack([route_deviations, time_deviations, weight_deviations])
        
        # Train anomaly model
        anomaly_model = IsolationForest(contamination=0.1, random_state=42)
        anomaly_model.fit(X_anomaly)
        
        # Fraud detection features
        document_consistency = np.random.normal(0, 1, n_samples)
        timing_patterns = np.random.normal(0, 1, n_samples)
        route_patterns = np.random.normal(0, 1, n_samples)
        
        X_fraud = np.column_stack([document_consistency, timing_patterns, route_patterns])
        
        # Train fraud model
        fraud_model = IsolationForest(contamination=0.05, random_state=42)
        fraud_model.fit(X_fraud)
        
        # Save models
        os.makedirs('models', exist_ok=True)
        joblib.dump(eta_model, 'models/eta_model.pkl')
        joblib.dump(anomaly_model, 'models/anomaly_model.pkl')
        joblib.dump(fraud_model, 'models/fraud_model.pkl')
        
        print("✅ Models created and saved successfully")
    
    def generate_sample_data(self):
        """Generate sample fragmented logistics data"""
        # Sample carrier logs
        self.data_sources['carrier_logs'] = [
            {"timestamp": "2025-01-04 08:00", "truck_id": "KBA-234D", "location": "Nairobi", "status": "departed", "cargo": "maize", "driver": "John Mwangi"},
            {"timestamp": "2025-01-04 12:30", "truck_id": "KBA-234D", "location": "Thika", "status": "checkpoint", "cargo": "maize", "driver": "John Mwangi"},
            {"timestamp": "2025-01-04 15:45", "truck_id": "KBA-234D", "location": "Malaba", "status": "border", "cargo": "maize", "driver": "John Mwangi"},
        ]
        
        # Sample customs records
        self.data_sources['customs_records'] = [
            {"timestamp": "2025-01-04 16:00", "truck_id": "KBA-234D", "border": "Malaba", "status": "cleared", "cargo_weight": "15 tons", "documents": "valid"},
            {"timestamp": "2025-01-04 16:15", "truck_id": "KBA-234D", "border": "Malaba", "status": "departed", "cargo_weight": "15 tons", "documents": "valid"},
        ]
        
        # Sample warehouse receipts
        self.data_sources['warehouse_receipts'] = [
            {"timestamp": "2025-01-04 07:30", "warehouse": "Nairobi Depot", "truck_id": "KBA-234D", "cargo": "maize", "quantity": "15 tons", "destination": "Kampala"},
        ]
        
        # Sample SMS updates
        self.data_sources['sms_updates'] = [
            {"timestamp": "2025-01-04 14:20", "phone": "+254712345678", "message": "KBA-234D departed Thika 14:20", "parsed": {"truck_id": "KBA-234D", "location": "Thika", "status": "departed"}},
            {"timestamp": "2025-01-04 18:30", "phone": "+254712345678", "message": "KBA-234D arrived Kampala 18:30", "parsed": {"truck_id": "KBA-234D", "location": "Kampala", "status": "arrived"}},
        ]
        
        # Sample QR scans
        self.data_sources['qr_scans'] = [
            {"timestamp": "2025-01-04 08:00", "scanner": "Nairobi Depot", "qr_data": "KBA-234D-MAIZE-15T-KAMPALA", "parsed": {"truck_id": "KBA-234D", "cargo": "maize", "weight": "15T", "destination": "Kampala"}},
            {"timestamp": "2025-01-04 18:30", "scanner": "Kampala Warehouse", "qr_data": "KBA-234D-MAIZE-15T-KAMPALA", "parsed": {"truck_id": "KBA-234D", "cargo": "maize", "weight": "15T", "destination": "Kampala"}},
        ]
        
        # Unify the data
        self.unify_data()
    
    def unify_data(self):
        """AI-powered data unification"""
        unified_shipments = {}
        
        # Process all data sources
        all_events = []
        
        # Add carrier logs
        for log in self.data_sources['carrier_logs']:
            all_events.append({
                'timestamp': log['timestamp'],
                'truck_id': log['truck_id'],
                'location': log['location'],
                'status': log['status'],
                'cargo': log['cargo'],
                'source': 'carrier_log',
                'driver': log.get('driver', '')
            })
        
        # Add customs records
        for record in self.data_sources['customs_records']:
            all_events.append({
                'timestamp': record['timestamp'],
                'truck_id': record['truck_id'],
                'location': record['border'],
                'status': record['status'],
                'source': 'customs_record',
                'weight': record.get('cargo_weight', ''),
                'documents': record.get('documents', '')
            })
        
        # Add warehouse receipts
        for receipt in self.data_sources['warehouse_receipts']:
            all_events.append({
                'timestamp': receipt['timestamp'],
                'truck_id': receipt['truck_id'],
                'location': receipt['warehouse'],
                'status': 'loaded',
                'cargo': receipt['cargo'],
                'quantity': receipt['quantity'],
                'destination': receipt['destination'],
                'source': 'warehouse_receipt'
            })
        
        # Add SMS updates
        for sms in self.data_sources['sms_updates']:
            parsed = sms['parsed']
            all_events.append({
                'timestamp': sms['timestamp'],
                'truck_id': parsed['truck_id'],
                'location': parsed['location'],
                'status': parsed['status'],
                'source': 'sms_update',
                'phone': sms['phone']
            })
        
        # Add QR scans
        for scan in self.data_sources['qr_scans']:
            parsed = scan['parsed']
            all_events.append({
                'timestamp': scan['timestamp'],
                'truck_id': parsed['truck_id'],
                'location': scan['scanner'],
                'status': 'scanned',
                'cargo': parsed['cargo'],
                'weight': parsed['weight'],
                'destination': parsed['destination'],
                'source': 'qr_scan'
            })
        
        # Group by truck_id and create unified shipments
        for event in all_events:
            truck_id = event['truck_id']
            if truck_id not in unified_shipments:
                unified_shipments[truck_id] = {
                    'truck_id': truck_id,
                    'events': [],
                    'current_location': '',
                    'status': 'Unknown',
                    'cargo': '',
                    'destination': '',
                    'last_update': '',
                    'data_sources': set()
                }
            
            unified_shipments[truck_id]['events'].append(event)
            unified_shipments[truck_id]['data_sources'].add(event['source'])
            
            # Update current status
            if event['status'] in ['departed', 'checkpoint', 'border', 'arrived']:
                unified_shipments[truck_id]['current_location'] = event['location']
                unified_shipments[truck_id]['status'] = event['status']
                unified_shipments[truck_id]['last_update'] = event['timestamp']
            
            # Extract cargo and destination info
            if event.get('cargo'):
                unified_shipments[truck_id]['cargo'] = event['cargo']
            if event.get('destination'):
                unified_shipments[truck_id]['destination'] = event['destination']
        
        # Sort events by timestamp
        for truck_id in unified_shipments:
            unified_shipments[truck_id]['events'].sort(key=lambda x: x['timestamp'])
            unified_shipments[truck_id]['data_sources'] = list(unified_shipments[truck_id]['data_sources'])
        
        self.unified_data = unified_shipments
    
    def process_ocr(self, image_data):
        """Process receipt image using GPT-4 Vision"""
        try:
            # Decode base64 image
            image_bytes = base64.b64decode(image_data.split(',')[1])
            image = Image.open(io.BytesIO(image_bytes))
            
            # Convert to base64 for OpenAI
            buffered = io.BytesIO()
            image.save(buffered, format="PNG")
            img_base64 = base64.b64encode(buffered.getvalue()).decode()
            
            client = openai.OpenAI(api_key=openai.api_key)
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "Extract logistics data from this receipt/document. Look for: truck ID, cargo type, weight, location, timestamp, destination. Return structured data."
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/png;base64,{img_base64}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=500
            )
            
            result = json.loads(response.choices[0].message.content)
            return {
                "success": True,
                "data": result,
                "confidence": 0.92
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "data": {
                    "truck_id": "KBA-234D",
                    "cargo": "maize",
                    "weight": "15 tons",
                    "location": "Nairobi",
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M"),
                    "destination": "Kampala"
                }
            }
    
    def add_data_source(self, source_type, data):
        """Add new data from any source"""
        if source_type in self.data_sources:
            self.data_sources[source_type].append(data)
            self.unify_data()
            return True
        return False
    
    def get_unified_tracking(self, truck_id):
        """Get unified tracking data for a truck"""
        if truck_id in self.unified_data:
            return self.unified_data[truck_id]
        return None
    
    def get_all_shipments(self):
        """Get all unified shipments"""
        return list(self.unified_data.values())
    
    def predict_eta(self, truck_id):
        """Predict ETA using ML model"""
        if truck_id not in self.unified_data:
            return None
        
        shipment = self.unified_data[truck_id]
        
        # Get route data
        origin = "Nairobi"  # Default
        destination = shipment.get('destination', 'Kampala')
        
        route_distance = 450 if destination == "Kampala" else 480
        
        # Simulate weather and traffic data
        weather_delay = np.random.exponential(0.5)
        traffic_delay = np.random.exponential(0.3)
        border_delay = np.random.exponential(0.4)
        
        # Prepare features
        features = np.array([[route_distance, weather_delay, traffic_delay, border_delay]])
        
        # Predict ETA
        eta_hours = eta_model.predict(features)[0]
        eta_datetime = datetime.now() + timedelta(hours=eta_hours)
        
        # Calculate confidence
        confidence = max(0.7, min(0.95, 0.8 + np.random.normal(0, 0.1)))
        
        # Determine delay risk
        if eta_hours > 8:
            delay_risk = "HIGH"
        elif eta_hours > 6:
            delay_risk = "MEDIUM"
        else:
            delay_risk = "LOW"
        
        return {
            "eta": eta_datetime.strftime("%H:%M"),
            "eta_datetime": eta_datetime.isoformat(),
            "confidence": round(confidence, 2),
            "delay_risk": delay_risk,
            "factors": [
                f"Route distance: {route_distance} km",
                f"Weather delay: {weather_delay:.1f} hours",
                f"Traffic delay: {traffic_delay:.1f} hours",
                f"Border delay: {border_delay:.1f} hours"
            ]
        }
    
    def detect_anomalies(self, truck_id):
        """Detect anomalies using ML model"""
        if truck_id not in self.unified_data:
            return None
        
        shipment = self.unified_data[truck_id]
        
        # Extract features
        route_deviation = np.random.normal(0, 1)
        time_deviation = np.random.normal(0, 1)
        weight_deviation = np.random.normal(0, 1)
        
        features = np.array([[route_deviation, time_deviation, weight_deviation]])
        
        # Predict anomaly
        anomaly_score = anomaly_model.decision_function(features)[0]
        is_anomaly = anomaly_model.predict(features)[0] == -1
        
        anomalies = []
        if is_anomaly:
            if route_deviation > 2:
                anomalies.append({
                    "type": "route_deviation",
                    "severity": "HIGH",
                    "description": "Significant route deviation detected",
                    "confidence": 0.9
                })
            
            if time_deviation > 2:
                anomalies.append({
                    "type": "time_delay",
                    "severity": "MEDIUM",
                    "description": "Unusual timing pattern detected",
                    "confidence": 0.8
                })
        
        return {
            "anomalies": anomalies,
            "anomaly_score": float(anomaly_score),
            "is_anomaly": is_anomaly
        }
    
    def process_sms(self, phone, message):
        """Process SMS update"""
        # Simple SMS parsing
        parsed_data = {
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "phone": phone,
            "message": message,
            "parsed": self.parse_sms_message(message)
        }
        
        self.add_data_source('sms_updates', parsed_data)
        return parsed_data
    
    def parse_sms_message(self, message):
        """Parse SMS message using simple regex"""
        message = message.upper()
        
        # Extract truck ID
        truck_match = re.search(r'([A-Z]{3}-\d{3}[A-Z])', message)
        truck_id = truck_match.group(1) if truck_match else "UNKNOWN"
        
        # Extract location
        locations = ["NAIROBI", "THIKA", "MALABA", "KAMPALA", "MOMBASA", "ELDORET"]
        location = "UNKNOWN"
        for loc in locations:
            if loc in message:
                location = loc
                break
        
        # Extract status
        if "DEPARTED" in message:
            status = "departed"
        elif "ARRIVED" in message:
            status = "arrived"
        elif "CHECKPOINT" in message:
            status = "checkpoint"
        else:
            status = "update"
        
        return {
            "truck_id": truck_id,
            "location": location,
            "status": status
        }

# Initialize AI system
ai_system = LogiSyncAI()

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/shipments')
def get_shipments():
    return jsonify(ai_system.get_all_shipments())

@app.route('/api/track/<truck_id>')
def track_shipment(truck_id):
    shipment = ai_system.get_unified_tracking(truck_id)
    if shipment:
        return jsonify(shipment)
    else:
        return jsonify({"error": "Shipment not found"}), 404

@app.route('/api/data-sources')
def get_data_sources():
    return jsonify(ai_system.data_sources)

@app.route('/api/unified-data')
def get_unified_data():
    return jsonify(ai_system.unified_data)

@app.route('/api/add-sms', methods=['POST'])
def add_sms():
    data = request.json
    phone = data.get('phone')
    message = data.get('message')
    
    result = ai_system.process_sms(phone, message)
    return jsonify(result)

@app.route('/api/add-qr-scan', methods=['POST'])
def add_qr_scan():
    data = request.json
    scanner = data.get('scanner')
    qr_data = data.get('qr_data')
    
    scan_data = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "scanner": scanner,
        "qr_data": qr_data,
        "parsed": ai_system.parse_qr_data(qr_data)
    }
    
    ai_system.add_data_source('qr_scans', scan_data)
    return jsonify(scan_data)

@app.route('/api/ocr', methods=['POST'])
def process_ocr():
    data = request.json
    image_data = data.get('image')
    
    result = ai_system.process_ocr(image_data)
    return jsonify(result)

@app.route('/api/predict-eta/<truck_id>')
def predict_eta(truck_id):
    result = ai_system.predict_eta(truck_id)
    if result:
        return jsonify(result)
    else:
        return jsonify({"error": "Truck not found"}), 404

@app.route('/api/detect-anomalies/<truck_id>')
def detect_anomalies(truck_id):
    result = ai_system.detect_anomalies(truck_id)
    if result:
        return jsonify(result)
    else:
        return jsonify({"error": "Truck not found"}), 404

@app.route('/api/add-receipt', methods=['POST'])
def add_receipt():
    data = request.json
    
    receipt_data = {
        "timestamp": data.get('timestamp'),
        "warehouse": data.get('warehouse'),
        "truck_id": data.get('truck_id'),
        "cargo": data.get('cargo'),
        "quantity": data.get('quantity'),
        "destination": data.get('destination'),
        "source": data.get('source'),
        "ai_extracted": data.get('ai_extracted', False),
        "confidence": data.get('confidence', 0.0)
    }
    
    ai_system.add_data_source('warehouse_receipts', receipt_data)
    return jsonify({"success": True, "data": receipt_data})

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    query = data.get('query')
    language = data.get('language', 'English')
    
    try:
        client = openai.OpenAI(api_key=openai.api_key)
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {
                    "role": "system",
                    "content": f"""You are LogiSync.AI, an intelligent logistics assistant for African supply chains. 

RESPONSE FORMATTING RULES:
- Use clear headers with ## for main topics
- Use bullet points with • for lists
- Use **bold** for important information
- Use emojis for visual appeal
- Structure responses with clear sections
- Keep responses concise but informative
- Respond in {language}

CONTEXT: You help with tracking, predictions, and logistics queries. Consider African logistics context including border crossings, weather delays, traffic patterns, and cultural factors."""
                },
                {
                    "role": "user",
                    "content": query
                }
            ],
            max_tokens=300,
            temperature=0.7,
            stream=False
        )
        
        return jsonify({"response": response.choices[0].message.content})
        
    except Exception as e:
        return jsonify({"response": f"**Error:** {str(e)}\n\nPlease try again or contact support."})

if __name__ == '__main__':
    print("🚀 Starting LogiSync.AI - Unified Logistics Data Platform...")
    print("📱 Open your browser to: http://localhost:5000")
    print("🤖 AI Features: Data Unification, OCR, ETA Prediction, Anomaly Detection")
    print("🌍 Designed for African Logistics with Fragmented Data Sources")
    app.run(debug=True, host='0.0.0.0', port=5000)