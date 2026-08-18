import json
import random
import string
import urllib.request

def generate_id():
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=7))

req_get = urllib.request.Request("https://moneyku-db-default-rtdb.firebaseio.com/money_single_v1.json")
try:
    with urllib.request.urlopen(req_get) as response:
        data = json.loads(response.read().decode('utf-8'))
except Exception as e:
    print('Failed to GET from Firebase:', e)
    exit(1)

if not data: data = {}
if 'items' not in data: data['items'] = {}
if 'charlie' not in data['items']: data['items']['charlie'] = {}
if 'expenses' not in data['items']['charlie']: data['items']['charlie']['expenses'] = []

expenses_to_add = [
    { 'name': 'Reversal Annual Membership Fee', 'amount': -4000.00 },
    { 'name': 'Petron 1055705 F Pasig City', 'amount': 410.12 },
    { 'name': 'Grab Makati', 'amount': 576.00 },
    { 'name': 'Shopee Ph Mandaluyong', 'amount': 560.00 },
    { 'name': 'Shopee Ph Mandaluyong', 'amount': -251.00 },
    { 'name': 'Grab Pasig City', 'amount': 357.00 },
    { 'name': 'Move It Makati', 'amount': 67.00 },
    { 'name': 'Tiktok Shop Seller Taguig', 'amount': 181.73 },
    { 'name': 'Tiktok Shop Seller Taguig', 'amount': 60.00 },
    { 'name': 'Google *Google One London', 'amount': 604.99 },
    { 'name': 'Sm Cinema Ecom Smphi Pasay', 'amount': 2820.00 },
    { 'name': 'Sm Supermarket-Sm East Pasig', 'amount': 995.25 },
    { 'name': 'Shell Cfal Oasis Erod Pasig', 'amount': 1000.00 },
    { 'name': 'Move It Pasig City', 'amount': 114.00 },
    { 'name': 'Move It Pasig City', 'amount': 70.00 },
    { 'name': 'Shell-Presam Dona Juli Pasig', 'amount': 1000.00 },
    { 'name': 'Grab Pasig City', 'amount': 717.00 },
    { 'name': 'Grab Pasig City', 'amount': 27.00 },
    { 'name': 'Grab Pasig City', 'amount': 28.00 },
    { 'name': 'Grab Pasig City', 'amount': 149.00 },
    { 'name': 'Grab Makati', 'amount': 169.00 },
    { 'name': 'Grab Makati', 'amount': 336.00 },
    { 'name': 'Starbucks 385 Hampton Pasig', 'amount': 625.00 },
    { 'name': 'Shell-Presam Dona Juli Pasig', 'amount': 1000.00 },
    { 'name': 'Grab Pasig City', 'amount': 364.00 },
    { 'name': 'Tiktok Shop Seller Taguig', 'amount': 253.20 },
    { 'name': 'Tiktok Shop Seller Taguig', 'amount': 251.00 },
    { 'name': 'Tiktok Shop Seller Taguig', 'amount': 161.10 },
    { 'name': 'Tiktok Shop Seller Taguig', 'amount': 99.83 },
    { 'name': 'Tiktok Shop Seller Taguig', 'amount': 189.00 },
    { 'name': 'Tiktok Shop Seller Taguig', 'amount': 140.00 },
    { 'name': 'Tiktok Shop Seller Taguig', 'amount': 199.00 }
]

new_items = []
for exp in expenses_to_add:
    new_items.append({
        'id': generate_id(),
        'name': exp['name'],
        'amount': exp['amount'],
        'start': '2026-09',
        'end': None,
        'recurring': False,
        'dueDay': 3,
        'paymentMethod': 'bpi_platinum',
        'txDay': 14,
        'cutoffDay': 14
    })

expenses = data['items']['charlie']['expenses']
if isinstance(expenses, list):
    expenses.extend(new_items)
else:
    # it's a dict
    next_idx = len(expenses)
    for i, item in enumerate(new_items):
        expenses[str(next_idx + i)] = item

req_put = urllib.request.Request(
    "https://moneyku-db-default-rtdb.firebaseio.com/money_single_v1.json",
    data=json.dumps(data).encode('utf-8'),
    method='PUT',
    headers={'Content-Type': 'application/json'}
)

try:
    with urllib.request.urlopen(req_put) as response:
        print('Upload Status:', response.status)
        print(f'Success! Added {len(new_items)} items.')
except Exception as e:
    print('Failed to upload:', e)
