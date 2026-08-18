import urllib.request
import json

req = urllib.request.Request('https://moneyku-db-default-rtdb.firebaseio.com/money_single_v1.json')
try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode('utf-8'))
        items = data.get('items', {}).get('charlie', {}).get('expenses', [])
        
        bpi_august = []
        if isinstance(items, list):
            for i in items:
                if i and i.get('paymentMethod') == 'bpi_platinum' and i.get('start') == '2026-08':
                    bpi_august.append(i)
        else:
            for k, v in items.items():
                if v and v.get('paymentMethod') == 'bpi_platinum' and v.get('start') == '2026-08':
                    bpi_august.append(v)
                    
        print(f"Found {len(bpi_august)} BPI Platinum items in August 2026:")
        for item in bpi_august[:10]:
            print(f"- {item.get('name')} (amount: {item.get('amount')})")
except Exception as e:
    print('Error:', e)
