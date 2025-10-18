try:
    from dotenv import load_dotenv
    print('dotenv ok')
except Exception as e:
    print('dotenv fail', e)
