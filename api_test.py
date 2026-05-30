import requests
import json

url = "http://127.0.0.1:8000/api/parse"
payload = {"url": "https://www.youtube.com/watch?v=A5w_k3GAwrQ"}
headers = {"Content-Type": "application/json"}

try:
    response = requests.post(url, json=payload, headers=headers)
    print(f"Status Code: {response.status_code}")
    print("Response Content:")
    print(response.text)
except Exception as e:
    print(f"Request failed: {e}")
