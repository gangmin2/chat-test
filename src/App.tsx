import React, { useState } from 'react'
import './App.css'
import { Client } from '@stomp/stompjs';

const BASE_URI: string = 'ws://localhost:8080';
const TOKEN: string = 'accessToken';
const workspaceId: number = 1;
const username: string = 'user';

// 메시지 타입을 정의하는 인터페이스
interface Message {
  messageType: 'TALK' | 'ENTER' | 'EXIT';
  message: string;
  senderName: string;
}

const MESSAGES: Message[] = [
  {
    "messageType": "ENTER",
    "message": "sender 님이 입장했습니다.",
    "senderName": "sender",
  },
  {
    "messageType": "TALK",
    "message": "message",
    "senderName": "sender"
  },
  {
    "messageType": "TALK",
    "message": "message",
    "senderName": "sender"
  },
  {
    "messageType": "ENTER",
    "message": "sender2 님이 입장했습니다.",
    "senderName": "sender2",
  },
  {
    "messageType": "TALK",
    "message": "message",
    "senderName": "sender2"
  },
  {
    "messageType": "EXIT",
    "message": "sender2 님이 퇴장했습니다.",
    "senderName": "sender2",
  },
]

// Bubble 컴포넌트의 prop 타입을 정의하는 인터페이스
interface BubbleProps {
  messageType: 'TALK' | 'ENTER' | 'EXIT';
  message: string;
  senderName: string;
}

const Bubble: React.FC<BubbleProps> = ({ messageType, message, senderName }) => {
  if (messageType === 'ENTER' || messageType === 'EXIT') {
    return <p>{message}</p>;
  }
  if (messageType === 'TALK') {
    return <div style={{ margin: '16px 0' }} >
      <p style={{ margin: '0', }}>{senderName}</p>
      <p style={{ backgroundColor: '#eee', width: 'fit-content', padding: '4px 8px', borderRadius: '8px', margin: '0', }}>{message}</p>
    </div>;
  }
  return null;
};

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>(MESSAGES);
  const [inputMessage, setInputMessage] = useState('');

  const client = new Client({
    brokerURL: `${BASE_URI}/api/ws`,
    connectHeaders: {
      Authorization: TOKEN,
    },
    reconnectDelay: 5000,
    onConnect: () => {
      client.subscribe(`/api/sub/${workspaceId}`, message => {
        if (message.body) {
          const newMessage: Message = {
            messageType: 'TALK',
            message: message.body,
            senderName: 'username',
          };
          setMessages((prevMessages) => [...prevMessages, newMessage]);
        } else {
          alert('got empty message');
        }
      });
      client.publish({
        destination: `/api/pub/${workspaceId}`,
        body: JSON.stringify({
          messageType: "ENTER",
          message: `${username}님이 입장했습니다.`,
        }),
        headers: { Authorization: TOKEN },
      });
    },
    onDisconnect: () => {
      client.publish({
        destination: `/api/pub/${workspaceId}`,
        body: JSON.stringify({
          messageType: "EXIT",
          message: `${username}님이 퇴장했습니다.`,
        }),
        headers: { Authorization: TOKEN },
      });
    }
  });

  const sendMessage = () => {
    if (inputMessage.trim() !== '') {
      client.publish({
        destination: `/api/pub/${workspaceId}`,
        body: JSON.stringify({
          messageType: 'TALK',
          message: inputMessage,
          senderName: username,
        }),
        headers: { Authorization: TOKEN },
      });

      setInputMessage('');
    }
  };

  return (
    <div>
      <div>
        채팅 (<span>4</span>)
      </div>

      <input type="text" name="" id="" placeholder="Search" />

      <div>
        {messages.length === 0 ? (
          <p>채팅을 시작해보세요 :)</p>
        ) : (
          messages.map((msg, index) => (
            <Bubble
              key={index}
              messageType={msg.messageType}
              message={msg.message}
              senderName={msg.senderName}
            />
          ))
        )}
      </div>

      <form onSubmit={(e) => {
        e.preventDefault();
        sendMessage();
      }} >
        <input
          type="text"
          name="message"
          placeholder='채팅을 입력하세요'
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
        />
        <input type="submit" value="SEND" />
      </form>
    </div>
  );
};

export default App
