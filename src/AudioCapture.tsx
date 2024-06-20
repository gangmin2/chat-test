import { useEffect, useRef } from 'react';

const AudioCapture = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null); // 오디오 요소에 대한 참조

  useEffect(() => {
    const constraints = {
      audio: true,
      video: false
    };

    const setupAudioStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        handleSuccess(stream);
      } catch (error: any) {
        handleError(error);
      }
    };

    const handleSuccess = (stream: MediaStream) => {
      const audioTracks = stream.getAudioTracks();
      console.log('Got stream with constraints:', constraints);
      console.log('Using audio device: ' + audioTracks[0].label);
      stream.oninactive = () => {
        console.log('Stream ended');
      };

      if (audioRef.current) {
        audioRef.current.srcObject = stream;
      }
    };

    const handleError = (error: Error) => {
      const errorMessage = `navigator.MediaDevices.getUserMedia error: ${error.message}`;
      console.error(errorMessage);
    };

    setupAudioStream();

    return () => {
      if (audioRef.current?.srcObject) {
        const stream = audioRef.current.srcObject as MediaStream;
        const tracks = stream.getTracks();

        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div>
      <audio ref={audioRef} autoPlay controls></audio>
    </div>
  );
};

export default AudioCapture;
