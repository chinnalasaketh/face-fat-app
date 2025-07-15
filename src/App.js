import React, { useEffect, useRef, useState } from 'react';
import * as cam from '@mediapipe/camera_utils';
import * as faceMesh from '@mediapipe/face_mesh';
import * as draw from '@mediapipe/drawing_utils';

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [fatValue, setFatValue] = useState(null);
  const [jawCm, setJawCm] = useState(null);
  const [faceCm, setFaceCm] = useState(null);
  const lastUpdateRef = useRef(Date.now());

  const AVERAGE_IPD_CM = 6.3; // Average adult interpupillary distance

  function dist(p1, p2) {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
  }

  function drawLine(ctx, p1, p2, text, color = 'red') {
    const x1 = p1.x * canvasRef.current.width;
    const y1 = p1.y * canvasRef.current.height;
    const x2 = p2.x * canvasRef.current.width;
    const y2 = p2.y * canvasRef.current.height;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = '16px Arial';
    ctx.fillStyle = color;
    ctx.fillText(text, (x1 + x2) / 2, (y1 + y2) / 2 - 10);
  }

  const onResults = (results) => {
    const now = Date.now();
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const lm = results.multiFaceLandmarks[0];

      draw.drawConnectors(ctx, lm, faceMesh.FACEMESH_TESSELATION, {
        color: '#00FF00',
        lineWidth: 1,
      });

      // Calculate real-world scale using eye distance
      const ipdPixels = dist(lm[33], lm[263]);
      const pixelToCm = AVERAGE_IPD_CM / ipdPixels;

      const jawWidthPx = dist(lm[234], lm[454]);
      const faceHeightPx = dist(lm[152], lm[10]);

      const jawWidthCm = jawWidthPx * pixelToCm;
      const faceHeightCm = faceHeightPx * pixelToCm;

      const fatScore = ((jawWidthPx * 1.5) + (dist(lm[50], lm[280]) * 1.2)) / faceHeightPx;

      // Draw measurement lines
      drawLine(ctx, lm[234], lm[454], `Jaw: ${jawWidthCm.toFixed(1)} cm`, 'blue');
      drawLine(ctx, lm[10], lm[152], `Height: ${faceHeightCm.toFixed(1)} cm`, 'purple');

      // Update every 15 seconds
      if (now - lastUpdateRef.current > 15000) {
        setFatValue((fatScore * 100).toFixed(2));
        setJawCm(jawWidthCm.toFixed(1));
        setFaceCm(faceHeightCm.toFixed(1));
        lastUpdateRef.current = now;
      }
    }
  };

  useEffect(() => {
    const faceMeshInstance = new faceMesh.FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    faceMeshInstance.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    faceMeshInstance.onResults(onResults);

    if (videoRef.current) {
      const camera = new cam.Camera(videoRef.current, {
        onFrame: async () => {
          await faceMeshInstance.send({ image: videoRef.current });
        },
        width: 640,
        height: 480,
      });
      camera.start();
    }
  }, []);

  return (
    <div style={{ textAlign: 'center', marginTop: 20 }}>
      <h1><b>Face Fat Detector</b></h1>

      <div style={{
        display: 'inline-block',
        border: '2px solid black',
        borderRadius: 10,
        overflow: 'hidden'
      }}>
        <video
          ref={videoRef}
          style={{ display: 'none' }}
          width="640"
          height="480"
          autoPlay
        />
        <canvas
          ref={canvasRef}
          width="640"
          height="480"
        />
      </div>

      {fatValue && (
        <div style={{ marginTop: 20 }}>
          <h2>Detected Face Fat Value: <b>{fatValue}</b></h2>
          <p><b>Jaw Width:</b> {jawCm} cm</p>
          <p><b>Face Height:</b> {faceCm} cm</p>
          <p style={{ color: '#777' }}>(Updates every 15 seconds)</p>
        </div>
      )}
    </div>
  );
}

export default App;
