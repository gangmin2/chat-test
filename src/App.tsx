import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { StompConfig, Client, IMessage, StompSubscription } from '@stomp/stompjs';

const BASE_URI: string = 'ws://localhost:8080';
const workspaceId: number = 1;
const username: string = 'user';

interface Message {
  messageType: 'TALK' | 'ENTER' | 'EXIT';
  message: string;
  senderName: string;
}

interface PubMessage {
  messageType: 'TALK' | 'ENTER' | 'EXIT';
  message: string;
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
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const clientRef = useRef<Client | null>(null);
  const subscriptionRef = useRef<StompSubscription | null>(null);

  const handleWebSocketConnect = (client: Client) => {
    console.log('Connected to WebSocket');
    setIsConnected(true);

    subscriptionRef.current = client.subscribe(`/api/sub/${workspaceId}`, (message: IMessage) => {
      const newMessage = JSON.parse(message.body) as Message;
      setMessages((prevMessages) => [...prevMessages, newMessage]);
    });

    client.publish({
      destination: `/api/pub/${workspaceId}`,
      body: JSON.stringify({
        messageType: 'ENTER',
        message: `${username} 님이 입장했습니다.`,
      }),
    });
  }
  const handleWebSocketDisconnect = (client: Client) => {
    console.log('Disconnected from WebSocket');
    client.publish({
      destination: `/api/pub/${workspaceId}`,
      body: JSON.stringify({
        messageType: 'EXIT',
        message: `${username} 님이 퇴장했습니다.`,
      }),
    });
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }
    client.deactivate();
    setIsConnected(false);
  }

  useEffect(() => {
    const client = new Client({
      brokerURL: `${BASE_URI}/api/ws`,
      debug: (str) => {
        console.debug(str);
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onStompError: (frame) => {
        console.error('Broker reported error: ' + frame.headers['message']);
        console.error('Additional details: ' + frame.body);
      },
      onWebSocketError: (event) => {
        console.error('WebSocket error', event);
      },
      onWebSocketClose: () => {
        console.log('WebSocket closed');
        setIsConnected(false);
      },
      beforeConnect: () => {
        console.log('Attempting to connect...');
      },
      onConnect: () => handleWebSocketConnect(client),
      onDisconnect: () => handleWebSocketDisconnect(client),
    } as StompConfig);

    client.activate();
    clientRef.current = client;

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
      if (clientRef.current) {
        clientRef.current.deactivate();
      }
    }
  }, []);

  const sendMessage = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!inputMessage.trim() || !isConnected || !clientRef.current) {
      return;
    }
    console.log(inputMessage)
    const message: PubMessage = {
      messageType: 'TALK',
      message: inputMessage,
    };

    const stringifiedMessage = JSON.stringify(message);

    clientRef.current.publish({
      destination: `/api/pub/${workspaceId}`,
      body: stringifiedMessage,
    });

    setInputMessage('');
  };

  return (
    <div>
      <div>
        채팅 (<span>참여인원</span>)
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

      <form
        onSubmit={(e) => sendMessage(e)}
      >
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
