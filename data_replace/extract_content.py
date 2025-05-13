import os
import json

def load_json_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as file:
        return json.load(file)

def save_json_file(data, file_path):
    with open(file_path, 'w', encoding='utf-8') as file:
        json.dump(data, file, indent=4, ensure_ascii=False)
        
def main():
    content_list = []
    for file in os.listdir('fixed'):
        if file.endswith('.json'):
            json_data = load_json_file(os.path.join('fixed', file))
            for item in json_data:
                content_list.append(item['content'])

    save_json_file(content_list, os.path.join('content', 'content.json'))

if __name__ == '__main__':
    if not os.path.exists('content'):
        os.mkdir('content')
    main()
