import React, { useState, useEffect, useRef } from "react";
import Dexie from "dexie";
import "./App.css";

var BASE64_MARKER = ";base64,";

function convertDataURIToBinary(dataURI) {
  var base64Index = dataURI.indexOf(BASE64_MARKER) + BASE64_MARKER.length;
  var base64 = dataURI.substring(base64Index);
  var raw = window.atob(base64);
  var rawLength = raw.length;
  var array = new Uint8Array(new ArrayBuffer(rawLength));

  for (let i = 0; i < rawLength; i++) {
    array[i] = raw.charCodeAt(i);
  }
  return array;
}
const db = new Dexie("AudioDB");
db.version(1).stores({ audio: "id, data" });

const App = () => {
  const [playlist, setPlaylist] = useState([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [audioSrc, setAudioSrc] = useState(null);
  const audioRef = useRef(() => new Audio());

  useEffect(() => {
    const fetchData = async () => {
      const storedPlaylist = await db.audio.toArray();
      const lastPlayingFile = localStorage.getItem("lastPlayingFile");
      const lastPlayingPosition =
        parseFloat(localStorage.getItem("lastPlayingPosition")) || 0;

      if (lastPlayingFile) {
        setPlaylist([
          lastPlayingFile,
          ...storedPlaylist.map((item) => item.id),
        ]);
        setCurrentTrackIndex(0);

        const audioData = (await db.audio.get(lastPlayingFile))?.data;
        var binary = convertDataURIToBinary(audioData);
        setAudioSrc(
          URL.createObjectURL(new Blob([binary], { type: "audio/mp3" }))
        );

        const audioCanPlay = new Promise((resolve) => {
          audioRef.current.addEventListener("canplaythrough", resolve, {
            once: true,
          });
        });

        const audioPlaying = new Promise((resolve) => {
          audioRef.current.addEventListener("playing", resolve, { once: true });
        });

        audioCanPlay.then(() => {
          audioRef.current.currentTime = lastPlayingPosition;

          audioRef.current.addEventListener("pause", () => {
            localStorage.setItem(
              "lastPlayingPosition",
              audioRef.current.currentTime
            );
          });

          audioRef.current.addEventListener("play", () => {
            localStorage.setItem(
              "lastPlayingPosition",
              audioRef.current.currentTime
            );
          });

          audioPlaying.then(() => {
            if (audioRef.current.currentTime === lastPlayingPosition) {
              audioRef.current.play();
            }
          });

          audioRef.current.play();
        });
      } else {
        setPlaylist(storedPlaylist.map((item) => item.id));
      }
    };

    fetchData();
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];

    if (file) {
      const reader = new FileReader();

      reader.onload = async (event) => {
        const audioData = event.target.result;

        await db.audio.put({ id: file.name, data: audioData });

        setPlaylist((prevPlaylist) => [...prevPlaylist, file.name]);
      };

      reader.readAsDataURL(file);
    }
  };

  const handlePlayTrack = async (index) => {
    setCurrentTrackIndex(index);
    const audioData = (await db.audio.get(playlist[currentTrackIndex]))?.data;
    var binary = convertDataURIToBinary(audioData);
    setAudioSrc(URL.createObjectURL(new Blob([binary], { type: "audio/mp3" })));

    localStorage.setItem("lastPlayingFile", playlist[index]);
    localStorage.setItem("lastPlayingPosition", 0);
  };

  const handlePlayNext = async () => {
    const nextIndex = (currentTrackIndex + 1) % playlist.length;
    setCurrentTrackIndex(nextIndex);

    const nextTrack = playlist[nextIndex];
    const audioData = (await db.audio.get(nextTrack))?.data;
    var binary = convertDataURIToBinary(audioData);
    setAudioSrc(URL.createObjectURL(new Blob([binary], { type: "audio/mp3" })));
    localStorage.setItem("lastPlayingFile", nextTrack);
    localStorage.setItem("lastPlayingPosition", 0);
    audioRef.current.load();
    audioRef.current.play();
  };

  const handleTimeUpdate = () => {
    localStorage.setItem("lastPlayingPosition", audioRef.current.currentTime);
  };

  useEffect(() => {
    if (audioSrc) {
      audioRef.current.src = audioSrc;
      audioRef.current.load();
      audioRef.current.play();
    }
  }, [audioSrc]);
  console.log(audioRef);
  console.log(audioSrc);

  return (
    <div className="container">
      <input type="file" accept=".mp3" onChange={handleFileChange} />

      {playlist.length > 0 ? (
        <>
          <audio
            controls
            onEnded={handlePlayNext}
            onTimeUpdate={handleTimeUpdate}
            ref={audioRef}
            src={audioSrc}
            autoPlay
          />
          <div>
            <h2>Playlist</h2>
            <ul>
              {playlist.map((track, index) => (
                <li key={index} onClick={() => handlePlayTrack(index)}>
                  {track}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2>Now Playing</h2>
            <p>{playlist[currentTrackIndex]}</p>
          </div>
        </>
      ) : (
        <p>No MP3 files uploaded</p>
      )}
    </div>
  );
};

export default App;
