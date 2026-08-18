import urllib.request
import json

req_get = urllib.request.Request('https://moneyku-db-default-rtdb.firebaseio.com/money_single_v1.json')
try:
    with urllib.request.urlopen(req_get) as response:
        data = json.loads(response.read().decode('utf-8'))
except Exception as e:
    print('Failed to GET from Firebase:', e)
    exit(1)

count_deleted = 0
if 'items' in data and 'charlie' in data['items'] and 'expenses' in data['items']['charlie']:
    expenses = data['items']['charlie']['expenses']
    
    if isinstance(expenses, list):
        # Create a new list without the matching items
        new_expenses = []
        for exp in expenses:
            if exp and exp.get('paymentMethod') == 'bpi_platinum' and exp.get('start') == '2026-08':
                count_deleted += 1
            else:
                new_expenses.append(exp)
        data['items']['charlie']['expenses'] = new_expenses
    else:
        # It's a dict
        keys_to_delete = []
        for k, exp in expenses.items():
            if exp and exp.get('paymentMethod') == 'bpi_platinum' and exp.get('start') == '2026-08':
                keys_to_delete.append(k)
        for k in keys_to_delete:
            del data['items']['charlie']['expenses'][k]
            count_deleted += 1

if count_deleted > 0:
    req_put = urllib.request.Request(
        "https://moneyku-db-default-rtdb.firebaseio.com/money_single_v1.json",
        data=json.dumps(data).encode('utf-8'),
        method='PUT',
        headers={'Content-Type': 'application/json'}
    )

    try:
        with urllib.request.urlopen(req_put) as response:
            print('Upload Status:', response.status)
            print(f'Success! Deleted {count_deleted} BPI Platinum items from August 2026.')
    except Exception as e:
        print('Failed to upload:', e)
else:
    print('No items matched the criteria to delete.')
