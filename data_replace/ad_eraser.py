import os
import json
from dotenv import load_dotenv

# .env 파일 로드
def load_env():
    load_dotenv()
    ad_list = os.getenv('AD_TEXTS', '')
    
    return ad_list

def load_json_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as file:
        return json.load(file)

def save_json_file(data, file_path):
    with open(file_path, 'w', encoding='utf-8') as file:
        json.dump(data, file, indent=4, ensure_ascii=False)
        
def main():
    ad_list = load_env()
    for file in os.listdir('fixed'):
        if file.endswith('.json'):
            json_data = load_json_file(os.path.join('fixed', file))
            for item in json_data:
                for ad_text in ad_list:
                    if ad_text in item['content']:
                        item['content'] = item['content'].replace(ad_text, '')
            save_json_file(json_data, os.path.join('fixed', file))

if __name__ == '__main__':
    main()
