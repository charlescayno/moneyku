import json
import urllib.request

req_get = urllib.request.Request("https://moneyku-db-default-rtdb.firebaseio.com/money_single_v1.json")
try:
    with urllib.request.urlopen(req_get) as response:
        data = json.loads(response.read().decode('utf-8'))
except Exception as e:
    print('Failed to GET from Firebase:', e)
    exit(1)

count = 0
if 'items' in data and 'charlie' in data['items'] and 'expenses' in data['items']['charlie']:
    expenses = data['items']['charlie']['expenses']
    if isinstance(expenses, list):
        for exp in expenses:
            if exp and exp.get('paymentMethod') == 'bpi_platinum':
                exp['dueDay'] = 28
                count += 1
    else:
        for k, exp in expenses.items():
            if exp and exp.get('paymentMethod') == 'bpi_platinum':
                exp['dueDay'] = 28
                count += 1

req_put = urllib.request.Request(
    "https://moneyku-db-default-rtdb.firebaseio.com/money_single_v1.json",
    data=json.dumps(data).encode('utf-8'),
    method='PUT',
    headers={'Content-Type': 'application/json'}
)

try:
    with urllib.request.urlopen(req_put) as response:
        print('Upload Status:', response.status)
        print(f'Success! Updated {count} items.')
except Exception as e:
    print('Failed to upload:', e)
