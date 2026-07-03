import React, { useState, useEffect, useRef } from 'react';
import { Settings, RotateCcw, Activity, ShieldAlert, Target, Crosshair, ChevronRight, Clock, ScrollText, Play, Copy, Check, Users, Cpu, ArrowLeft, Key } from 'lucide-react';

// --- Firebase Integration ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';

let app, auth, db;
try {
  const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  // Graceful fallback if Firebase is not injected
}
const appId = typeof __app_id !== 'undefined' ? __app_id : 'chess-app';

// Basic profanity filter for nicknames
const BAD_WORDS = ['fuck', 'shit', 'bitch', 'ass', 'dick', 'cunt', 'pussy', 'whore', 'slut', 'fag', 'nigger', 'nigga', 'bastard', 'crap', 'douche', 'sex', 'porn'];
const isCleanName = (name) => {
  const lower = name.toLowerCase();
  return !BAD_WORDS.some(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      return regex.test(lower);
  });
};

// --- SVGs for Chess Pieces (Official Wikimedia Links) ---
const PieceImages = {
  wp: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg',
  bp: 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg',
  wn: 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg',
  bn: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg',
  wb: 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg',
  bb: 'https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg',
  wr: 'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg',
  br: 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg',
  wq: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg',
  bq: 'https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg',
  wk: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg',
  bk: 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg'
};

// --- Web Worker Engine ---
const engineWorkerCode = `
  try {
    importScripts('https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js');
  } catch(e) {}
  
  const pieceValues = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
  
  const pawnEvalWhite = [
    [0,  0,  0,  0,  0,  0,  0,  0], [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10], [5,  5, 10, 25, 25, 10,  5,  5],
    [0,  0,  0, 20, 20,  0,  0,  0], [5, -5,-10,  0,  0,-10, -5,  5],
    [5, 10, 10,-20,-20, 10, 10,  5], [0,  0,  0,  0,  0,  0,  0,  0]
  ];
  const knightEval = [
    [-50,-40,-30,-30,-30,-30,-40,-50], [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30], [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30], [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40], [-50,-40,-30,-30,-30,-30,-40,-50]
  ];
  const bishopEvalWhite = [
    [-20,-10,-10,-10,-10,-10,-10,-20], [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10], [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10], [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10], [-20,-10,-10,-10,-10,-10,-10,-20]
  ];
  const rookEvalWhite = [
    [ 0,  0,  0,  0,  0,  0,  0,  0], [ 5, 10, 10, 10, 10, 10, 10,  5],
    [-5,  0,  0,  0,  0,  0,  0, -5], [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5], [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5], [ 0,  0,  0,  5,  5,  0,  0,  0]
  ];
  const evalQueen = [
    [-20,-10,-10, -5, -5,-10,-10,-20], [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5,  5,  5,  5,  0,-10], [ -5,  0,  5,  5,  5,  5,  0, -5],
    [ 0,  0,  5,  5,  5,  5,  0, -5], [-10,  5,  5,  5,  5,  5,  0,-10],
    [-10,  0,  5,  0,  0,  0,  0,-10], [-20,-10,-10, -5, -5,-10,-10,-20]
  ];
  const kingEvalWhite = [
    [-30,-40,-40,-50,-50,-40,-40,-30], [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30], [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20], [-10,-20,-20,-20,-20,-20,-20,-10],
    [ 20, 20,  0,  0,  0,  0, 20, 20], [ 20, 30, 10,  0,  0, 10, 30, 20]
  ];

  function reverseBoard(board) { return board.slice().reverse(); }
  const pawnEvalBlack = reverseBoard(pawnEvalWhite);
  const bishopEvalBlack = reverseBoard(bishopEvalWhite);
  const rookEvalBlack = reverseBoard(rookEvalWhite);
  const kingEvalBlack = reverseBoard(kingEvalWhite);

  function evaluateBoard(game, depth = 0) {
    if (game.in_checkmate()) {
      return game.turn() === 'w' ? -30000 + depth : 30000 - depth;
    }
    if (game.in_draw() || game.in_stalemate() || game.in_threefold_repetition()) {
      return 0; // Draw
    }

    // BASELINE ADVANTAGE: White inherent tempo (+0.25 pawns)
    let totalEvaluation = 25; 
    
    const board = game.board();
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const piece = board[i][j];
        if (piece !== null) {
          let val = pieceValues[piece.type];
          let pstVal = 0;
          switch (piece.type) {
            case 'p': pstVal = piece.color === 'w' ? pawnEvalWhite[i][j] : pawnEvalBlack[i][j]; break;
            case 'n': pstVal = knightEval[i][j]; break;
            case 'b': pstVal = piece.color === 'w' ? bishopEvalWhite[i][j] : bishopEvalBlack[i][j]; break;
            case 'r': pstVal = piece.color === 'w' ? rookEvalWhite[i][j] : rookEvalBlack[i][j]; break;
            case 'q': pstVal = evalQueen[i][j]; break;
            case 'k': pstVal = piece.color === 'w' ? kingEvalWhite[i][j] : kingEvalBlack[i][j]; break;
          }
          totalEvaluation += (piece.color === 'w' ? (val + pstVal) : -(val + pstVal));
        }
      }
    }
    return totalEvaluation;
  }

  let searchAborted = false;
  let endTime = 0;
  let nodesEvaluated = 0;

  function minimax(game, depth, alpha, beta, isMaximizingPlayer) {
    nodesEvaluated++;
    
    if ((nodesEvaluated & 15) === 0 && Date.now() >= endTime) {
      searchAborted = true;
    }
    
    if (searchAborted) return evaluateBoard(game);
    if (depth === 0 || game.game_over()) return evaluateBoard(game, depth);

    const moves = game.moves();
    moves.sort((a, b) => (b.includes('x') ? 1 : 0) - (a.includes('x') ? 1 : 0));

    let bestVal = isMaximizingPlayer ? -Infinity : Infinity;

    for (let i = 0; i < moves.length; i++) {
      game.move(moves[i]);
      const val = minimax(game, depth - 1, alpha, beta, !isMaximizingPlayer);
      game.undo();

      if (searchAborted) return bestVal; 

      if (isMaximizingPlayer) {
        bestVal = Math.max(bestVal, val);
        alpha = Math.max(alpha, bestVal);
      } else {
        bestVal = Math.min(bestVal, val);
        beta = Math.min(beta, bestVal);
      }
      if (beta <= alpha) break;
    }
    return bestVal;
  }

  function getBestMove(game, maxDepth, timeLimitMs) {
    const moves = game.moves();
    if (moves.length === 0) return null;

    // PRE-SCAN: Instant Mate-in-1 check
    for (let i = 0; i < moves.length; i++) {
      game.move(moves[i]);
      if (game.in_checkmate()) {
        const evalScore = game.turn() === 'w' ? -29999 : 29999; // Using 29999 for strict M1 mapping
        game.undo();
        return { move: moves[i], eval: evalScore };
      }
      game.undo();
    }

    endTime = Date.now() + timeLimitMs;
    searchAborted = false;
    nodesEvaluated = 0;

    let globalBestMove = moves[0];
    let globalBestValue = game.turn() === 'w' ? -Infinity : Infinity;

    for (let currentDepth = 1; currentDepth <= maxDepth; currentDepth++) {
      let currentBestMove = null;
      let currentBestValue = game.turn() === 'w' ? -Infinity : Infinity;
      let alpha = -Infinity;
      let beta = Infinity;

      moves.sort((a, b) => (b.includes('x') ? 1 : 0) - (a.includes('x') ? 1 : 0));
      
      if (globalBestMove) {
        const prevBestIndex = moves.indexOf(globalBestMove);
        if (prevBestIndex > 0) moves.unshift(moves.splice(prevBestIndex, 1)[0]);
      }

      for (let i = 0; i < moves.length; i++) {
        game.move(moves[i]);
        const boardValue = minimax(game, currentDepth - 1, alpha, beta, game.turn() === 'w');
        game.undo();

        if (searchAborted) break;

        if (game.turn() === 'w') {
          if (boardValue > currentBestValue) {
            currentBestValue = boardValue;
            currentBestMove = moves[i];
          }
          alpha = Math.max(alpha, currentBestValue);
        } else {
          if (boardValue < currentBestValue) {
            currentBestValue = boardValue;
            currentBestMove = moves[i];
          }
          beta = Math.min(beta, currentBestValue);
        }
      }

      if (searchAborted) break;

      globalBestMove = currentBestMove || globalBestMove;
      globalBestValue = currentBestValue;
    }
    
    return { move: globalBestMove, eval: globalBestValue };
  }

  self.onmessage = function(e) {
    try {
      if (typeof Chess === 'undefined') {
        self.postMessage({ error: "chess.js failed to load.", turnId: e.data.turnId });
        return;
      }
      
      const { fen, elo, maxTimeMs, maxDepth, turnId, evalOnly } = e.data;
      const game = new Chess(fen);
      const moves = game.moves();
      
      if (moves.length === 0) {
        self.postMessage({ move: null, eval: 0, turnId, evalOnly }); return;
      }

      if (evalOnly) {
          const result = getBestMove(game, 3, maxTimeMs);
          self.postMessage({ move: null, eval: result.eval, turnId, evalOnly: true });
          return;
      }

      if (elo <= 200) {
        const randomMove = moves[Math.floor(Math.random() * moves.length)];
        self.postMessage({ move: randomMove, eval: evaluateBoard(game), turnId });
        return;
      }

      if (elo < 1000) {
        for (let i = 0; i < moves.length; i++) {
          game.move(moves[i]);
          if (game.in_checkmate()) {
            const evalScore = game.turn() === 'w' ? -29999 : 29999;
            game.undo();
            self.postMessage({ move: moves[i], eval: evalScore, turnId });
            return;
          }
          game.undo();
        }

        let scoredMoves = [];
        for (let i = 0; i < moves.length; i++) {
          game.move(moves[i]);
          scoredMoves.push({ move: moves[i], score: evaluateBoard(game) });
          game.undo();
        }

        if (game.turn() === 'w') scoredMoves.sort((a, b) => b.score - a.score);
        else scoredMoves.sort((a, b) => a.score - b.score);

        const worstPercent = (1000 - elo) / 800; 
        let maxIndex = Math.floor(scoredMoves.length * worstPercent);
        if (maxIndex >= scoredMoves.length) maxIndex = scoredMoves.length - 1;
        
        const selectedIndex = Math.floor(Math.random() * (maxIndex + 1));
        self.postMessage({ move: scoredMoves[selectedIndex].move, eval: scoredMoves[selectedIndex].score, turnId });
        return;
      }

      let depth = 2; 
      if (elo >= 2000) depth = 3;
      if (elo >= 3000) depth = maxDepth || 4; 

      const result = getBestMove(game, depth, maxTimeMs);
      result.turnId = turnId; 
      self.postMessage(result);

    } catch (err) {
      self.postMessage({ error: err.toString(), turnId: e.data.turnId });
    }
  };
`;

export default function App() {
  const [user, setUser] = useState(null);

  // Setup & Game State
  const [showSetup, setShowSetup] = useState(true);
  const [setupMode, setSetupMode] = useState('bot'); 
  const [mpMode, setMpMode] = useState('host'); 
  const [username, setUsername] = useState('Player');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [nameError, setNameError] = useState('');
  const [opponentName, setOpponentName] = useState('Bot');
  
  const [setupTime, setSetupTime] = useState(10); 
  const [setupElo, setSetupElo] = useState(4000);
  const [setupColor, setSetupColor] = useState('w');
  const [setupDepth, setSetupDepth] = useState(4); 
  
  const [gameMode, setGameMode] = useState('bot');
  const [matchId, setMatchId] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [hasJoinedLink, setHasJoinedLink] = useState(false);

  const [chessReady, setChessReady] = useState(false);
  const [game, setGame] = useState(null);
  const [board, setBoard] = useState([]);
  
  const [evals, setEvals] = useState([]);
  const [rawEval, setRawEval] = useState(25); // Stores the raw centipawn / mate score
  
  const [playerColor, setPlayerColor] = useState('w');
  const [elo, setElo] = useState(4000);
  const [maxEngineDepth, setMaxEngineDepth] = useState(4);
  const [engineThinkTimeLimit, setEngineThinkTimeLimit] = useState(2500); 

  const [isEngineThinking, setIsEngineThinking] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [gameStatus, setGameStatus] = useState('Active');
  const [reviewPanelOpen, setReviewPanelOpen] = useState(false);
  
  const [engineResponse, setEngineResponse] = useState(null);
  const turnIdRef = useRef(0); 

  // Clocks
  const [totalGameTime, setTotalGameTime] = useState(0);
  const [whiteClock, setWhiteClock] = useState(600);
  const [blackClock, setBlackClock] = useState(600);
  
  const workerRef = useRef(null);
  const workerTimeoutRef = useRef(null);
  const scrollRef = useRef(null);

  // 1. Initialize Firebase Auth
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Auto-join Multiplayer via URL
  useEffect(() => {
    const checkUrlForMatch = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const matchParam = searchParams.get('match');
      if (matchParam && user && db && game && !hasJoinedLink) {
        setHasJoinedLink(true);
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'chess_matches', matchParam);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const data = snap.data();
            setGameMode('multiplayer');
            setMatchId(matchParam);
            setPlayerColor(data.hostColor === 'w' ? 'b' : 'w');
            setWhiteClock(data.whiteClock);
            setBlackClock(data.blackClock);
            setShowSetup(false);
            
            if (data.status === 'waiting') {
               await updateDoc(docRef, { status: 'active' });
               setGameStatus('Active');
            } else {
               setGameStatus('Active');
            }
            
            game.load(data.fen);
            setBoard([...game.board()]);
            triggerEngineEval(game);
        }
      }
    };
    checkUrlForMatch();
  }, [user, db, game, hasJoinedLink]);

  // 3. Multiplayer Live Sync (Snapshot)
  useEffect(() => {
     if (gameMode !== 'multiplayer' || !matchId || !user || !db || !game) return;
     const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'chess_matches', matchId);
     const unsub = onSnapshot(docRef, (docSnap) => {
         if (docSnap.exists()) {
             const data = docSnap.data();
             if (data.status === 'active' && gameStatus === 'Waiting for Opponent...') {
                 setGameStatus('Active');
                 if (playerColor === 'w' && data.joinerName) setOpponentName(data.joinerName);
                 if (playerColor === 'b' && data.hostName) setOpponentName(data.hostName);
             }
             if (data.status === 'timeout_black') setGameStatus("Black Wins by Timeout!");
             if (data.status === 'timeout_white') setGameStatus("White Wins by Timeout!");
             
             // If opponent moved
             if (data.fen !== game.fen()) {
                 game.load(data.fen);
                 setBoard([...game.board()]);
                 
                 const elapsedSinceMove = Math.floor((Date.now() - data.lastMoveTime) / 1000);
                 const isWhiteTurn = data.fen.includes(' w ');
                 setWhiteClock(data.whiteClock - (isWhiteTurn ? elapsedSinceMove : 0));
                 setBlackClock(data.blackClock - (!isWhiteTurn ? elapsedSinceMove : 0));
                 
                 triggerEngineEval(game);
                 
                 if (game.in_checkmate()) setGameStatus(`Checkmate! ${game.turn() === 'w' ? 'Black' : 'White'} wins.`);
                 else if (game.in_draw()) setGameStatus("Draw");
             }
         }
     });
     return () => unsub();
  }, [gameMode, matchId, user, game, playerColor, gameStatus]);

  // 4. Initialize Worker Safely
  const initWorker = () => {
    if (workerRef.current) workerRef.current.terminate();
    const blob = new Blob([engineWorkerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    
    worker.onmessage = (e) => {
      if (e.data.turnId === turnIdRef.current) setEngineResponse(e.data);
    };
    worker.onerror = (err) => {
      setEngineResponse({ error: 'WORKER_CRASH', turnId: turnIdRef.current });
    };
    workerRef.current = worker;
  };

  // Load chess.js script
  useEffect(() => {
    const loadDependencies = async () => {
      const script = document.createElement('script');
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js";
      script.onload = () => {
        const newGame = new window.Chess();
        setGame(newGame);
        setBoard(newGame.board());
        initWorker();
        setChessReady(true);
      };
      document.head.appendChild(script);
    };
    loadDependencies();
    return () => {
      if (workerRef.current) workerRef.current.terminate();
      clearTimeout(workerTimeoutRef.current);
    };
  }, []); 

  // Process Engine Mailbox
  useEffect(() => {
    if (engineResponse && engineResponse.turnId === turnIdRef.current && game) {
      clearTimeout(workerTimeoutRef.current);
      
      if (engineResponse.evalOnly) {
         setRawEval(engineResponse.eval || 0);
         setEvals(prev => [...prev, engineResponse.eval || 0]);
         setEngineResponse(null);
         return;
      }

      if (isEngineThinking && gameMode === 'bot') {
        let finalMove = engineResponse.move;
        let finalEval = engineResponse.eval || 0;

        if (engineResponse.error || !finalMove) {
          const moves = game.moves();
          finalMove = moves.length > 0 ? moves[Math.floor(Math.random() * moves.length)] : null;
          finalEval = 0;
          initWorker(); 
        }

        if (finalMove) {
          game.move(finalMove);
          setBoard([...game.board()]);
          setRawEval(finalEval);
          setEvals(prev => [...prev, finalEval]);
          
          if (game.in_checkmate()) setGameStatus(`Checkmate! ${game.turn() === 'w' ? 'Black' : 'White'} wins.`);
          else if (game.in_draw()) setGameStatus("Draw");
        }
        setIsEngineThinking(false);
      }
      setEngineResponse(null); 
    }
  }, [engineResponse, isEngineThinking, game, gameMode]);

  // Clock Ticker (Multiplayer Only)
  useEffect(() => {
    let interval;
    if (gameStatus === 'Active' && chessReady && game && gameMode === 'multiplayer') {
      interval = setInterval(() => {
        setTotalGameTime(prev => prev + 1);
        if (game.turn() === 'w') {
          setWhiteClock(prev => {
            if (prev <= 1) { 
               setGameStatus("Black Wins by Timeout!"); 
               if (game.turn() === playerColor) {
                 updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chess_matches', matchId), { status: 'timeout_black' });
               }
               return 0; 
            }
            return prev - 1;
          });
        } else {
          setBlackClock(prev => {
            if (prev <= 1) { 
               setGameStatus("White Wins by Timeout!"); 
               if (game.turn() === playerColor) {
                 updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chess_matches', matchId), { status: 'timeout_white' });
               }
               return 0; 
            }
            return prev - 1;
          });
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameStatus, chessReady, game?.turn(), gameMode, playerColor, matchId]);

  // Auto-scroll Move History
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [game?.history()]);

  const triggerEngineEval = (currentGame) => {
    turnIdRef.current += 1;
    workerRef.current.postMessage({
        fen: currentGame.fen(), elo: 4000, maxTimeMs: 1000, maxDepth: 4, turnId: turnIdRef.current, evalOnly: true
    });
  };

  const handleSquareClick = (squareStr) => {
    if (showSetup || gameStatus.includes('Win') || gameStatus.includes('Draw') || !game) return;
    if (gameMode === 'multiplayer' && game.turn() !== playerColor) return;
    if (gameMode === 'bot' && isEngineThinking) return;

    const pieceAtSquare = game.get(squareStr);

    if (selectedSquare) {
      const moveOpts = { from: selectedSquare, to: squareStr, promotion: 'q' };
      const move = game.move(moveOpts);
      
      if (move) {
        setBoard([...game.board()]);
        setSelectedSquare(null);
        setLegalMoves([]);
        
        if (game.in_checkmate()) setGameStatus(`Checkmate! ${game.turn() === 'w' ? 'Black' : 'White'} wins.`);
        else if (game.in_draw()) setGameStatus("Draw");
        
        if (gameMode === 'bot' && !game.game_over()) {
          setIsEngineThinking(true);
          turnIdRef.current += 1;
          workerTimeoutRef.current = setTimeout(() => {
            setEngineResponse({ error: 'TIMEOUT', turnId: turnIdRef.current });
          }, engineThinkTimeLimit + 1000); 

          workerRef.current.postMessage({ 
            fen: game.fen(), elo, maxTimeMs: engineThinkTimeLimit, maxDepth: maxEngineDepth, turnId: turnIdRef.current 
          });
        } else if (gameMode === 'multiplayer') {
          updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chess_matches', matchId), {
              fen: game.fen(), whiteClock, blackClock, lastMoveTime: Date.now()
          });
          if (!game.game_over()) triggerEngineEval(game);
        }
      } else {
        if (pieceAtSquare && pieceAtSquare.color === game.turn()) {
           setSelectedSquare(squareStr);
           setLegalMoves(game.moves({ square: squareStr, verbose: true }));
        } else {
           setSelectedSquare(null);
           setLegalMoves([]);
        }
      }
    } else {
      if (pieceAtSquare && pieceAtSquare.color === game.turn() && game.turn() === playerColor) {
        setSelectedSquare(squareStr);
        setLegalMoves(game.moves({ square: squareStr, verbose: true }));
      }
    }
  };

  const createMultiplayerMatch = async () => {
    if (!user || !db) return;
    const newMatchId = Math.random().toString(36).substr(2, 6).toUpperCase();
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'chess_matches', newMatchId);
    
    await setDoc(docRef, {
        host: user.uid, hostColor: setupColor, hostName: username,
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        whiteClock: setupTime * 60, blackClock: setupTime * 60,
        lastMoveTime: Date.now(), status: 'waiting'
    });
    
    setGameMode('multiplayer');
    setMatchId(newMatchId);
    setPlayerColor(setupColor);
    setWhiteClock(setupTime * 60);
    setBlackClock(setupTime * 60);
    setGameStatus('Waiting for Opponent...');
    setShowSetup(false);
  };

  const joinMultiplayerMatch = async () => {
    if (!joinCodeInput || !user || !db) return;
    const code = joinCodeInput.trim().toUpperCase();
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'chess_matches', code);
    const snap = await getDoc(docRef);
    
    if (snap.exists()) {
        const data = snap.data();
        if (data.status !== 'waiting') {
            setNameError("Match is active or finished.");
            return;
        }
        
        await updateDoc(docRef, { status: 'active', joiner: user.uid, joinerName: username });
        
        setGameMode('multiplayer');
        setMatchId(code);
        setPlayerColor(data.hostColor === 'w' ? 'b' : 'w');
        setWhiteClock(data.whiteClock);
        setBlackClock(data.blackClock);
        setOpponentName(data.hostName || 'Opponent');
        setGameStatus('Active');
        setShowSetup(false);
        
        game.load(data.fen);
        setBoard([...game.board()]);
        triggerEngineEval(game);
    } else {
        setNameError("Invalid join code.");
    }
  };

  const cancelHosting = async () => {
    if (gameMode === 'multiplayer' && matchId && db) {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'chess_matches', matchId);
        await updateDoc(docRef, { status: 'cancelled' });
    }
    setShowSetup(true);
    setGameStatus('Active');
    setMatchId(null);
  };

  const applySettingsAndStart = () => {
    setNameError("");
    if (!username.trim() || !isCleanName(username)) {
       setNameError("Please enter a valid, appropriate nickname.");
       return;
    }

    if (setupMode === 'multiplayer') {
       if (mpMode === 'host') {
           createMultiplayerMatch();
       } else {
           joinMultiplayerMatch();
       }
       return;
    }

    setOpponentName(`Bot (${setupElo} ELO)`);
    setGameMode('bot');
    setPlayerColor(setupColor);
    setElo(setupElo);
    setMaxEngineDepth(setupDepth);
    setShowSetup(false);
    
    if (game) {
      game.reset();
      setBoard([...game.board()]);
      setEvals([]);
      setRawEval(25); // Inherent white advantage on new game
      setGameStatus('Active');
      setSelectedSquare(null);
      setLegalMoves([]);
      setTotalGameTime(0);
      setIsEngineThinking(false);
      setEngineResponse(null);
      clearTimeout(workerTimeoutRef.current);
      
      if (setupColor === 'b') {
        setIsEngineThinking(true);
        turnIdRef.current += 1;
        workerTimeoutRef.current = setTimeout(() => setEngineResponse({ error: 'TIMEOUT', turnId: turnIdRef.current }), engineThinkTimeLimit + 1000);
        workerRef.current.postMessage({ 
          fen: game.fen(), elo: setupElo, maxTimeMs: engineThinkTimeLimit, maxDepth: setupDepth, turnId: turnIdRef.current 
        });
      }
    }
  };

  const copyInviteLink = () => {
    const link = `${window.location.origin}${window.location.pathname}?match=${matchId}`;
    const textArea = document.createElement("textarea");
    textArea.value = link;
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {}
    document.body.removeChild(textArea);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const generateGameReview = () => {
    const history = game.history({ verbose: true });
    const review = [];
    
    for (let i = 1; i < evals.length; i++) {
      const swing = evals[i] - evals[i-1];
      const movePlayer = i % 2 === 1 ? 'w' : 'b';
      let flag = 'Good';
      let msg = '';
      
      // Swing based on raw centipawn numbers (100 = 1 pawn)
      const advantageLost = movePlayer === 'w' ? -swing : swing;
      
      if (advantageLost > 300) { flag = 'Blunder'; msg = `Massive blunder. Shifted material balance or allowed mate.`; }
      else if (advantageLost > 150) { flag = 'Mistake'; msg = `Significant mistake. Lost space or a piece.`; }
      else if (advantageLost > 80) { flag = 'Inaccuracy'; msg = `Slight inaccuracy. King safety compromised.`; }

      if (flag !== 'Good' && history[i-1]) {
        // Format previous and after evaluations beautifully
        const fmtEval = (v) => {
           if (v > 20000) return "M";
           if (v < -20000) return "-M";
           return (v > 0 ? '+' : '') + (v / 100).toFixed(1);
        };

        review.push({ 
            moveNum: Math.ceil(i/2), 
            color: movePlayer, 
            move: history[i-1].san, 
            flag, msg, 
            evalBefore: fmtEval(evals[i-1]), 
            evalAfter: fmtEval(evals[i]) 
        });
      }
    }
    return review;
  };

  if (!chessReady) {
    return <div className="flex h-screen items-center justify-center bg-gray-900 text-white font-mono animate-pulse">Loading Rules & Core Engine...</div>;
  }

  // --- Dynamic Eval Bar Formatting ---
  let evalText = "";
  let evalPercentage = 50;
  
  if (rawEval >= 29000) {
      evalText = rawEval > 29900 ? "M1" : "M";
      evalPercentage = 100;
  } else if (rawEval <= -29000) {
      evalText = rawEval < -29900 ? "-M1" : "-M";
      evalPercentage = 0;
  } else {
      const displayEval = rawEval / 100;
      evalText = (displayEval > 0 ? '+' : '') + displayEval.toFixed(1);
      const visualEval = Math.max(-10, Math.min(10, displayEval));
      evalPercentage = Math.max(0, Math.min(100, 50 + (visualEval * 5))); 
  }
  
  const boardRanks = playerColor === 'w' ? [0,1,2,3,4,5,6,7] : [7,6,5,4,3,2,1,0];
  const boardFiles = playerColor === 'w' ? [0,1,2,3,4,5,6,7] : [7,6,5,4,3,2,1,0];

  const topClock = playerColor === 'w' ? blackClock : whiteClock;
  const bottomClock = playerColor === 'w' ? whiteClock : blackClock;
  const isTopTurn = game && game.turn() !== playerColor;
  const isBottomTurn = game && game.turn() === playerColor;

  const moveHistory = game ? game.history() : [];
  const notationPairs = [];
  for(let i=0; i<moveHistory.length; i+=2) {
    notationPairs.push({ w: moveHistory[i], b: moveHistory[i+1] });
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col md:flex-row font-sans relative">
      
      {/* --- PRE-GAME SETUP MODAL --- */}
      {showSetup && (
        <div className="absolute inset-0 z-50 bg-gray-900/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-800 border-2 border-gray-700 rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h1 className="text-3xl font-bold text-white mb-6 text-center flex items-center justify-center gap-3">
              <Settings className="text-blue-500"/> Match Setup
            </h1>
            
            <div className="mb-6">
               <label className="block text-sm font-semibold text-gray-300 mb-2">Your Nickname:</label>
               <input 
                  type="text" 
                  maxLength={15}
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setNameError(''); }}
                  className="w-full bg-gray-900 text-white px-4 py-3 rounded-lg border border-gray-600 focus:border-blue-500 outline-none"
                  placeholder="Enter a nickname..."
               />
               {nameError && <p className="text-red-400 text-xs mt-2 font-bold">{nameError}</p>}
            </div>

            <div className="flex gap-4 mb-6">
                <button onClick={() => setSetupMode('bot')} className={`flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 border-2 transition ${setupMode === 'bot' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-gray-700 border-gray-600 text-gray-400'}`}><Cpu size={18}/> Vs Bot</button>
                <button onClick={() => setSetupMode('multiplayer')} className={`flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 border-2 transition ${setupMode === 'multiplayer' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-gray-700 border-gray-600 text-gray-400'}`}><Users size={18}/> Vs Friend</button>
            </div>

            <div className="space-y-6">
              {setupMode === 'multiplayer' && (
                 <div className="flex gap-2 p-1 bg-gray-900 rounded-lg">
                    <button onClick={() => setMpMode('host')} className={`flex-1 py-2 rounded-md font-semibold ${mpMode === 'host' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Host Game</button>
                    <button onClick={() => setMpMode('join')} className={`flex-1 py-2 rounded-md font-semibold ${mpMode === 'join' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Join Game</button>
                 </div>
              )}

              {(setupMode === 'bot' || (setupMode === 'multiplayer' && mpMode === 'host')) && (
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Play As:</label>
                  <div className="flex gap-4">
                    <button onClick={() => setSetupColor('w')} className={`flex-1 py-3 rounded-lg font-bold border-2 ${setupColor === 'w' ? 'bg-gray-100 text-gray-900 border-gray-100' : 'bg-gray-700 text-white border-gray-600 hover:bg-gray-600'}`}>White</button>
                    <button onClick={() => setSetupColor('b')} className={`flex-1 py-3 rounded-lg font-bold border-2 ${setupColor === 'b' ? 'bg-gray-900 text-white border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-gray-700 text-white border-gray-600 hover:bg-gray-600'}`}>Black</button>
                  </div>
                </div>
              )}

              {setupMode === 'multiplayer' ? (
                mpMode === 'host' ? (
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">Clock Time (Minutes): {setupTime}</label>
                      <input type="range" min="1" max="60" value={setupTime} onChange={(e) => setSetupTime(Number(e.target.value))} className="w-full accent-blue-500"/>
                    </div>
                ) : (
                    <div>
                       <label className="block text-sm font-semibold text-gray-300 mb-2">Enter Join Code:</label>
                       <input 
                          type="text" 
                          maxLength={6}
                          value={joinCodeInput}
                          onChange={(e) => { setJoinCodeInput(e.target.value.toUpperCase()); setNameError(''); }}
                          className="w-full bg-gray-900 text-center text-white px-4 py-4 rounded-lg border border-gray-600 focus:border-blue-500 outline-none text-2xl tracking-widest font-mono uppercase"
                          placeholder="XXXXXX"
                       />
                    </div>
                )
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Opponent Engine ELO: {setupElo}</label>
                    <input type="range" min="200" max="4000" step="100" value={setupElo} onChange={(e) => setSetupElo(Number(e.target.value))} className="w-full accent-blue-500"/>
                  </div>
                  {setupElo >= 3000 && (
                    <div className="p-4 bg-gray-700/50 rounded-lg border border-yellow-600/30">
                      <label className="block text-sm font-semibold text-yellow-500 mb-2">GM Depth Limit: {setupDepth}</label>
                      <input type="range" min="3" max="5" value={setupDepth} onChange={(e) => setSetupDepth(Number(e.target.value))} className="w-full accent-yellow-500"/>
                    </div>
                  )}
                </>
              )}

              <button onClick={applySettingsAndStart} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-lg py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95">
                {setupMode === 'multiplayer' ? (mpMode === 'host' ? <><Play fill="currentColor" /> Create Match</> : <><Key fill="currentColor" /> Join Match</>) : <><Play fill="currentColor" /> Start Bot Match</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MULTIPLAYER WAITING OVERLAY */}
      {gameMode === 'multiplayer' && gameStatus === 'Waiting for Opponent...' && (
        <div className="absolute inset-0 z-40 bg-gray-900/80 flex items-center justify-center backdrop-blur-sm p-4">
            <div className="bg-gray-800 p-8 rounded-xl border border-gray-700 shadow-2xl text-center max-w-lg w-full">
               <h2 className="text-3xl font-bold text-white mb-2">Match Created</h2>
               <p className="text-gray-400 mb-8">Share this Join Code or the Direct Link with your opponent.</p>
               
               <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 mb-4">
                  <p className="text-sm text-gray-500 uppercase tracking-widest font-bold mb-2">Join Code</p>
                  <div className="text-5xl font-mono text-white tracking-[0.2em] font-bold">
                    {matchId}
                  </div>
               </div>

               <div className="flex items-center gap-2 mb-8">
                  <input 
                    readOnly 
                    value={`${window.location.origin}${window.location.pathname}?match=${matchId}`} 
                    className="flex-1 bg-gray-900 text-gray-300 px-4 py-3 rounded-lg border border-gray-700 outline-none text-sm"
                  />
                  <button onClick={copyInviteLink} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-lg font-bold flex items-center gap-2 transition text-sm whitespace-nowrap">
                     {linkCopied ? <Check size={16} /> : <Copy size={16} />} {linkCopied ? "Copied" : "Copy Link"}
                  </button>
               </div>

               <div className="flex items-center justify-center gap-2 text-yellow-500 bg-yellow-500/10 py-3 rounded-lg mb-6">
                  <Activity className="animate-pulse" size={18} />
                  <span className="font-semibold">Waiting for opponent to connect...</span>
               </div>

               <button onClick={cancelHosting} className="w-full bg-red-600/20 hover:bg-red-600/40 text-red-400 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition border border-red-600/50">
                  <ArrowLeft size={18} /> Cancel & Go Back
               </button>
            </div>
        </div>
      )}

      {/* Left Sidebar - Settings & Stats */}
      <div className={`md:w-72 p-6 bg-gray-800 border-r border-gray-700 flex flex-col shadow-xl z-10 ${showSetup || gameStatus === 'Waiting for Opponent...' ? 'opacity-20 pointer-events-none' : ''}`}>
        <button 
          onClick={() => { window.location.href = window.location.origin + window.location.pathname; }}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 px-4 rounded-lg font-bold flex items-center justify-center gap-2 transition shadow"
        >
          <RotateCcw size={18} /> Resign / Setup Match
        </button>

        <div className="mt-6 bg-gray-700 p-5 rounded-xl border border-gray-600 flex-1">
          <h3 className="font-bold mb-4 flex items-center gap-2 text-blue-300 text-lg">
            <Activity size={20} /> Match Data
          </h3>
          <p className="text-sm font-medium mb-3">Opponent: <span className="text-white font-bold">{opponentName}</span></p>
          <p className="text-sm font-medium mb-3">Status: <span className={gameStatus === 'Active' ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>{gameStatus}</span></p>
          <p className="text-sm text-gray-300 mb-3">Eval: <span className="font-mono bg-gray-800 px-2 py-0.5 rounded text-white font-bold">{evalText}</span></p>
          
          <div className="h-[80px] mt-6">
            {isEngineThinking && gameMode === 'bot' ? (
              <div className="bg-gray-900 border border-gray-600 rounded-lg p-3 shadow-inner text-center">
                 <p className="text-xs text-yellow-400 animate-pulse mb-1">Bot Computing...</p>
                 <span className="text-xl font-mono text-white tracking-widest flex items-center justify-center gap-2">
                   <Cpu size={16} className="text-gray-400"/>
                 </span>
              </div>
            ) : gameMode === 'multiplayer' ? (
              <div className="bg-gray-800/50 border border-gray-600/50 rounded-lg p-3 text-indigo-400 text-sm flex items-center justify-center h-full text-center flex-col gap-1">
                <Cpu size={16}/> <span>4000 ELO Analysis Active</span>
              </div>
            ) : (
              <div className="bg-gray-800/50 border border-gray-600/50 rounded-lg p-3 text-gray-500 text-sm flex items-center justify-center h-full">Your turn...</div>
            )}
          </div>
        </div>

        <button 
          onClick={() => setReviewPanelOpen(!reviewPanelOpen)}
          className={`mt-4 w-full border ${reviewPanelOpen ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-indigo-500 text-indigo-400 hover:bg-indigo-900'} py-3 px-4 rounded-lg font-bold transition`}
        >
          Engine Post-Game Review
        </button>
      </div>

      {/* Main Content - The Board & Clocks */}
      <div className={`flex-1 flex flex-col items-center justify-center p-6 relative ${showSetup || gameStatus === 'Waiting for Opponent...' ? 'opacity-20 pointer-events-none' : ''}`}>
        
        {reviewPanelOpen && (
          <div className="absolute inset-0 bg-gray-900/95 z-50 p-8 overflow-y-auto backdrop-blur-sm">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                <Target className="text-indigo-400" size={32}/> Deep Engine Analysis
              </h2>
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-2xl">
                {generateGameReview().length === 0 ? (
                  <div className="text-center text-gray-500 py-12 text-lg">Play significant moves to generate tactical analysis.</div>
                ) : (
                  <div className="space-y-4">
                    {generateGameReview().map((review, idx) => (
                      <div key={idx} className="flex gap-4 p-4 rounded-lg bg-gray-700/50 border-l-4 border-red-500">
                        <div className="flex-shrink-0 mt-1">
                          {review.flag === 'Blunder' && <ShieldAlert className="text-red-500" size={24} />}
                          {review.flag === 'Mistake' && <Crosshair className="text-orange-500" size={24} />}
                          {review.flag === 'Inaccuracy' && <ChevronRight className="text-yellow-500" size={24} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-white text-lg">Move {review.moveNum}. {review.color === 'w' ? 'White' : 'Black'}: {review.move}</span>
                            <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${review.flag === 'Blunder' ? 'bg-red-500/20 text-red-400' : review.flag === 'Mistake' ? 'bg-orange-500/20 text-orange-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{review.flag}</span>
                          </div>
                          <p className="text-gray-300 mt-2">{review.msg}</p>
                          <p className="text-sm text-gray-400 mt-2 font-mono bg-gray-900 inline-block px-2 py-1 rounded">Eval Shift: {review.evalBefore} → {review.evalAfter}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => setReviewPanelOpen(false)} className="mt-8 bg-gray-700 hover:bg-gray-600 text-white px-8 py-3 rounded-lg font-bold">Close Analysis</button>
            </div>
          </div>
        )}

        {/* --- Top Clock (Multiplayer Only) --- */}
        {gameMode === 'multiplayer' && (
          <div className={`mb-4 px-6 py-3 rounded-xl shadow-lg flex items-center justify-between transition-colors ${isTopTurn && gameStatus === 'Active' ? 'bg-gray-100 text-gray-900 border-4 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'bg-gray-800 text-gray-500 border-4 border-gray-700'}`}>
            <div className="flex items-center gap-3">
               <div className={`w-5 h-5 rounded-sm ${playerColor === 'w' ? 'bg-black' : 'bg-white border-2 border-gray-400'}`}></div>
               <span className="font-bold text-lg truncate max-w-[150px]">{opponentName}</span>
            </div>
            <span className="font-mono text-3xl font-bold tracking-widest">{formatTime(topClock)}</span>
          </div>
        )}

        <div className="flex items-stretch shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-lg overflow-hidden border-4 border-gray-800 bg-gray-800">
          {/* Evaluation Bar */}
          <div className="w-8 bg-gray-900 relative flex flex-col border-r border-gray-700">
            {playerColor === 'w' ? (
              <>
                <div className="absolute w-full h-full bg-[#302e2c] z-0"></div>
                <div className="w-full bg-[#ececd7] z-10 transition-all duration-500 ease-out absolute bottom-0" style={{ height: `${evalPercentage}%` }}></div>
                <div className="absolute inset-0 z-20 flex flex-col justify-between items-center py-2 font-mono text-[10px] font-bold pointer-events-none mix-blend-difference text-white">
                  <span>B</span><span className="bg-black/50 px-1 rounded font-bold">{evalText}</span><span>W</span>
                </div>
              </>
            ) : (
               <>
                <div className="absolute w-full h-full bg-[#ececd7] z-0"></div>
                <div className="w-full bg-[#302e2c] z-10 transition-all duration-500 ease-out absolute bottom-0" style={{ height: `${100 - evalPercentage}%` }}></div>
                <div className="absolute inset-0 z-20 flex flex-col justify-between items-center py-2 font-mono text-[10px] font-bold pointer-events-none mix-blend-difference text-white">
                  <span>W</span><span className="bg-black/50 px-1 rounded font-bold">{evalText}</span><span>B</span>
                </div>
              </>
            )}
          </div>

          {/* Chess Board */}
          <div className="w-[320px] h-[320px] sm:w-[480px] sm:h-[480px] md:w-[600px] md:h-[600px] grid grid-cols-8 grid-rows-8">
            {boardRanks.map((i) => 
              boardFiles.map((j) => {
                const isLight = (i + j) % 2 === 0;
                const fileIndex = j;
                const rankIndex = 8 - i;
                const squareStr = String.fromCharCode(97 + fileIndex) + rankIndex;
                
                const piece = board[i][j];
                const isSelected = selectedSquare === squareStr;
                const isLegalMove = legalMoves.some(m => m.to === squareStr);
                
                return (
                  <div 
                    key={squareStr} onClick={() => handleSquareClick(squareStr)}
                    className={`relative flex items-center justify-center cursor-pointer select-none ${isLight ? 'bg-[#ebecd0]' : 'bg-[#739552]'} ${isSelected ? 'bg-[#f4f680]' : ''}`}
                  >
                    {isLegalMove && !piece && <div className="w-5 h-5 bg-black/20 rounded-full absolute z-10 pointer-events-none"></div>}
                    {isLegalMove && piece && <div className="absolute inset-0 border-4 border-black/20 rounded-full z-10 m-1 pointer-events-none"></div>}
                    
                    {piece && (
                      <img 
                        src={PieceImages[`${piece.color}${piece.type}`]} 
                        className="w-[85%] h-[85%] z-20 transition-transform hover:scale-105 pointer-events-none select-none"
                        alt={`${piece.color}${piece.type}`}
                        draggable="false"
                      />
                    )}

                    {j === boardFiles[0] && <span className={`absolute top-0.5 left-1 text-[10px] font-bold pointer-events-none ${isLight ? 'text-[#739552]' : 'text-[#ebecd0]'}`}>{rankIndex}</span>}
                    {i === boardRanks[7] && <span className={`absolute bottom-0.5 right-1 text-[10px] font-bold pointer-events-none ${isLight ? 'text-[#739552]' : 'text-[#ebecd0]'}`}>{String.fromCharCode(97 + fileIndex)}</span>}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* --- Bottom Clock (Multiplayer Only) --- */}
        {gameMode === 'multiplayer' && (
          <div className={`mt-4 px-6 py-3 rounded-xl shadow-lg flex items-center justify-between transition-colors ${isBottomTurn && gameStatus === 'Active' ? 'bg-gray-100 text-gray-900 border-4 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'bg-gray-800 text-gray-500 border-4 border-gray-700'}`}>
             <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-sm ${playerColor === 'w' ? 'bg-white border-2 border-gray-400' : 'bg-black'}`}></div>
                <span className="font-bold text-lg truncate max-w-[150px]">{username}</span>
             </div>
             <span className="font-mono text-3xl font-bold tracking-widest">{formatTime(bottomClock)}</span>
          </div>
        )}
      </div>

      {/* Right Sidebar - Notation & PGN */}
      <div className={`md:w-64 p-4 bg-gray-800 border-l border-gray-700 flex flex-col shadow-xl z-10 ${showSetup || gameStatus === 'Waiting for Opponent...' ? 'opacity-20 pointer-events-none' : ''}`}>
        <h2 className="text-lg font-bold mb-4 text-white flex items-center gap-2 border-b border-gray-700 pb-3">
          <ScrollText size={20} className="text-gray-400" /> Move History
        </h2>
        
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-1.5 pr-2 font-mono text-sm pb-4">
          {notationPairs.length === 0 ? (
            <p className="text-gray-500 text-center italic mt-6">Match not started.</p>
          ) : (
            notationPairs.map((pair, index) => (
              <div key={index} className={`flex py-2 px-3 rounded-md ${index % 2 === 0 ? 'bg-gray-700/40' : ''}`}>
                <span className="w-8 text-gray-500 font-bold">{index + 1}.</span>
                <span className="flex-1 text-white font-medium hover:bg-gray-600 px-1 rounded cursor-default">{pair.w}</span>
                <span className="flex-1 text-gray-300 hover:bg-gray-600 px-1 rounded cursor-default">{pair.b || ''}</span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}