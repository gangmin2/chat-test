import React, { FormEvent, useEffect, useState, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const WEBSOCKET_URI: string = 'ws://localhost:8080';
const workspaceId: number = 1;

interface Message {
  messageType: 'TALK' | 'ENTER' | 'EXIT';
  message: string;
  senderName: string;
}

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
    return (
      <div style={{ margin: '16px 0' }}>
        <p style={{ margin: '0' }}>{senderName}</p>
        <p style={{ backgroundColor: '#eee', width: 'fit-content', padding: '4px 8px', borderRadius: '8px', margin: '0' }}>{message}</p>
      </div>
    );
  }
  return null;
};

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [subscriberCount, setSubscriberCount] = useState<number>(0);
  const clientRef = useRef<Client | null>(null);

  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS(`${WEBSOCKET_URI}/api/ws`),
      onConnect: () => {
        client.subscribe(`/api/sub/chat/${workspaceId}`, (message) => {
          const newMessage = JSON.parse(message.body);
          setMessages((prevMessages) => [...prevMessages, newMessage]);
        });

        client.subscribe(`/api/sub/chat/${workspaceId}/count`, (message) => {
          setSubscriberCount(parseInt(message.body, 10));
        });

        client.publish({
          destination: `/api/pub/chat/${workspaceId}`,
          body: JSON.stringify({
            messageType: 'ENTER',
            message: '',
          }),
        });

        client.publish({
          destination: `/api/pub/chat/${workspaceId}/count`,
          body: '',
        });
      },
      onStompError: (frame) => {
        console.error('Broker reported error: ' + frame.headers['message']);
        console.error('Additional details: ' + frame.body);
      },
      debug: (str) => console.debug(str),
    });

    client.activate();
    clientRef.current = client;

    return () => {
      if (clientRef.current) {
        clientRef.current.publish({
          destination: `/api/pub/chat/${workspaceId}`,
          body: JSON.stringify({
            messageType: 'EXIT',
            message: '',
          }),
        });

        clientRef.current.deactivate();
        clientRef.current = null;
      }
    };
  }, []);

  const sendMessage = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!inputMessage.trim()) {
      return;
    }

    if (clientRef.current) {
      clientRef.current.publish({
        destination: `/api/pub/chat/${workspaceId}`,
        body: JSON.stringify({
          messageType: 'TALK',
          message: inputMessage,
        }),
      });
    }

    setInputMessage('');
  };

  return (
    <div>
      <div>
        채팅 (<span>{subscriberCount}</span>)
      </div>

      <input type="text" name="" id="" placeholder="Search" />

      <div>
        {messages.length === 0 ? (
          <p>채팅을 시작해보세요</p>
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

      <form onSubmit={sendMessage}>
        <input
          type="text"
          name="message"
          placeholder="채팅을 입력하세요"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
        />
        <input type="submit" value="SEND" />
      </form>
    </div>
  );
};

export default App;
