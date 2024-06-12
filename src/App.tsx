import React from 'react'
import './App.css'

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
    "messageType": "TALK",
    "message": "message",
    "senderName": "sender2"
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
    return <div style={{ margin: '16px 0'}} >
      <p style={{ margin: '0', }}>{senderName}</p>
      <p style={{ backgroundColor: '#eee', width: 'fit-content', padding: '4px 8px', borderRadius: '8px', margin: '0', }}>{message}</p>
    </div>;
  }
  return null;
};

const App: React.FC = () => {
  return (
    <div>
      <div>
        채팅 (<span>4</span>)
      </div>

      <input type="text" name="" id="" placeholder="Search" />

      <div>
        {MESSAGES.map((msg, index) => (
          <Bubble
            key={index}
            messageType={msg.messageType}
            message={msg.message}
            senderName={msg.senderName}
          />
        ))}
      </div>
      
      <form>
        <input type="text" name="message" placeholder='채팅을 입력하세요' />
        <input type="submit" value="SEND" />
      </form>
    </div>
  );
};

export default App
