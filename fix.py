with open('js/ui/components.js', 'r') as f:
    content = f.read()

import re
fixed = content.replace(
    'src=\"https://www.google.com/s2/favicons?domain=&sz=128\"',
    'src=\"https://www.google.com/s2/favicons?domain=&sz=128\"'
)

fixed = re.sub(
    r'<img src=\"assets/banks/\$\{bank\}\.png\"',
    r'<img src=\"https://www.google.com/s2/favicons?domain=&sz=128\"',
    fixed
)

with open('js/ui/components.js', 'w') as f:
    f.write(fixed)
print('Fixed broken icon references')
