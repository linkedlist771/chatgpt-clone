from flask import render_template, send_file, redirect, request
from time import time
from os import urandom


class Website:
    def __init__(self, app) -> None:
        self.app = app
        self.routes = {
            '/': {
                'function': lambda: redirect('/chat'),
                'methods': ['GET', 'POST']
            },
            '/claude/chat': {
                'function': self.claude_chat,
                'methods': ['GET', 'POST']
            },
            '/claude/status': {
                'function': self.claude_status,
                'methods': ['GET', 'POST']
            },
            
            '/chat/': {
                'function': self._index,
                'methods': ['GET', 'POST']
            },
            '/chat/<conversation_id>': {
                'function': self._chat,
                'methods': ['GET', 'POST']
            },
            '/assets/<folder>/<file>': {
                'function': self._assets,
                'methods': ['GET', 'POST']
            }
        }

    def _chat(self, conversation_id):
        if not '-' in conversation_id:
            return redirect(f'/chat')

        return render_template('index.html', chat_id=conversation_id)
    
    def claude_chat(self):
        api_key = request.args.get('api_key')
        client_idx = request.args.get('client_idx')
        client_type = request.args.get('client_type')
        return render_template('chat.html', api_key=api_key, client_idx=client_idx, client_type=client_type)
    
    def claude_status(self):
        api_key = request.args.get('api_key')

        return render_template('status.html', api_key=api_key)
    

    def _index(self):
        return render_template('index.html', chat_id=f'{urandom(4).hex()}-{urandom(2).hex()}-{urandom(2).hex()}-{urandom(2).hex()}-{hex(int(time() * 1000))[2:]}')

    def _assets(self, folder: str, file: str):
        try:
            return send_file(f"./../client/{folder}/{file}", as_attachment=False)
        except:
            return "File not found", 404
