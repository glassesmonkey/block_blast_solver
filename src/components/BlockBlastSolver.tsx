import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../utils/translations';

// 基础类型定义
type Board = number[][];

type Position = {
  row: number;
  col: number;
};

type ClearedLines = {
  rows: number[];
  cols: number[];
};

type SolutionStep = {
  figureIndex: number;
  position: Position;
  clearedLines: ClearedLines;
  resultBoard: Board;
  sourceMap: number[][];
};

export const BlockBlastSolver: React.FC = () => {
  const { t } = useTranslation();
  
  // State 定义
  const [mainBoard, setMainBoard] = useState<Board>(
    Array(8).fill(0).map(() => Array(8).fill(0))
  );
  
  const [figures, setFigures] = useState<Board[]>([
    Array(5).fill(0).map(() => Array(5).fill(0)),
    Array(5).fill(0).map(() => Array(5).fill(0)),
    Array(5).fill(0).map(() => Array(5).fill(0))
  ]);
  
  const [selectedFigureIndex, setSelectedFigureIndex] = useState<number>(0);
  const [solutionSteps, setSolutionSteps] = useState<SolutionStep[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [isNewRound, setIsNewRound] = useState<boolean>(true);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isErasing, setIsErasing] = useState<boolean>(false);

  // 定义 figure 颜色映射
  const figureColors = ['bg-red-500', 'bg-yellow-500', 'bg-blue-500'];

  // 添加评估函数
  const evaluateState = (board: Board): number => {
    let score = 0;
    const WEIGHTS = {
      COMPLETE_LINE: 100,
      NEAR_COMPLETE_LINE: 30,
      ISOLATED_PENALTY: -20
    };
    
    // 检查完整行和接近完整的行
    for (let i = 0; i < 8; i++) {
      let rowCount = 0;
      for (let j = 0; j < 8; j++) {
        if (board[i][j]) rowCount++;
      }
      if (rowCount === 8) {
        score += WEIGHTS.COMPLETE_LINE;
      } else if (rowCount >= 6) {
        score += WEIGHTS.NEAR_COMPLETE_LINE;
      }
    }

    // 检查完整列和接近完整的列
    for (let j = 0; j < 8; j++) {
      let colCount = 0;
      for (let i = 0; i < 8; i++) {
        if (board[i][j]) colCount++;
      }
      if (colCount === 8) {
        score += WEIGHTS.COMPLETE_LINE;
      } else if (colCount >= 6) {
        score += WEIGHTS.NEAR_COMPLETE_LINE;
      }
    }

    // 检查孤立空格
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        if (!board[i][j]) {
          let isIsolated = true;
          const directions = [[0,1], [0,-1], [1,0], [-1,0]];
          for (const [di, dj] of directions) {
            const ni = i + di;
            const nj = j + dj;
            if (ni >= 0 && ni < 8 && nj >= 0 && nj < 8 && !board[ni][nj]) {
              isIsolated = false;
              break;
            }
          }
          if (isIsolated) score += WEIGHTS.ISOLATED_PENALTY;
        }
      }
    }

    return score;
  };

  // 检查是否可以消除行或列
  const checkAndClearLines = (board: Board): { newBoard: Board; clearedLines: ClearedLines } => {
    const newBoard = board.map(row => [...row]);
    const clearedLines: ClearedLines = { rows: [], cols: [] };
    
    // 检查行
    for (let i = 0; i < 8; i++) {
      if (newBoard[i].every(cell => cell === 1)) {
        clearedLines.rows.push(i);
      }
    }
    
    // 检查列
    for (let j = 0; j < 8; j++) {
      if (newBoard.every(row => row[j] === 1)) {
        clearedLines.cols.push(j);
      }
    }

    // 清除行和列
    if (clearedLines.rows.length > 0 || clearedLines.cols.length > 0) {
      clearedLines.rows.forEach(i => {
        newBoard[i] = Array(8).fill(0);
      });
      clearedLines.cols.forEach(j => {
        for (let i = 0; i < 8; i++) {
          newBoard[i][j] = 0;
        }
      });
    }
    
    return { newBoard, clearedLines };
  };

  // 判断是否可以在指定位置放置 figure
  const canPlaceFigure = (board: Board, figure: Board, pos: Position): boolean => {
    let minRow = 4, maxRow = 0, minCol = 4, maxCol = 0;
    let hasBlocks = false;
    
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        if (figure[i][j] === 1) {
          hasBlocks = true;
          minRow = Math.min(minRow, i);
          maxRow = Math.max(maxRow, i);
          minCol = Math.min(minCol, j);
          maxCol = Math.max(maxCol, j);
        }
      }
    }

    if (!hasBlocks) return false;

    const figureHeight = maxRow - minRow + 1;
    const figureWidth = maxCol - minCol + 1;
    
    if (pos.row + figureHeight > 8 || pos.col + figureWidth > 8) return false;

    for (let i = minRow; i <= maxRow; i++) {
      for (let j = minCol; j <= maxCol; j++) {
        if (figure[i][j] === 1) {
          const boardRow = pos.row + (i - minRow);
          const boardCol = pos.col + (j - minCol);
          if (board[boardRow][boardCol] === 1) {
            return false;
          }
        }
      }
    }

    return true;
  };

  // 放置 figure
  const placeFigure = (board: Board, figure: Board, pos: Position): Board => {
    let minRow = 4, maxRow = 0, minCol = 4, maxCol = 0;
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        if (figure[i][j] === 1) {
          minRow = Math.min(minRow, i);
          maxRow = Math.max(maxRow, i);
          minCol = Math.min(minCol, j);
          maxCol = Math.max(maxCol, j);
        }
      }
    }

    const newBoard = board.map(row => [...row]);
    
    for (let i = minRow; i <= maxRow; i++) {
      for (let j = minCol; j <= maxCol; j++) {
        if (figure[i][j] === 1) {
          const boardRow = pos.row + (i - minRow);
          const boardCol = pos.col + (j - minCol);
          if (boardRow >= 0 && boardRow < 8 && boardCol >= 0 && boardCol < 8) {
            newBoard[boardRow][boardCol] = 1;
          }
        }
      }
    }
    
    return newBoard;
  };

  // 计算解决方案
  const calculateSolution = () => {
    let currentBoard = mainBoard.map(row => [...row]);
    let initialSourceMap = Array(8).fill(0).map(() => Array(8).fill(-1));
    
    if (!isNewRound && solutionSteps.length > 0) {
      const lastStep = solutionSteps[solutionSteps.length - 1];
      currentBoard = lastStep.resultBoard.map(row => [...row]);
    }

    let currentSourceMap = initialSourceMap.map(row => [...row]);

    const findBestMoveForFigure = (
      board: Board,
      figure: Board,
      figureIndex: number,
      sourceMap: number[][]
    ): SolutionStep | null => {
      let bestScore = -Infinity;
      let bestStep: SolutionStep | null = null;
      
      let minRow = 4, maxRow = 0, minCol = 4, maxCol = 0;
      let hasBlocks = false;
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          if (figure[i][j] === 1) {
            hasBlocks = true;
            minRow = Math.min(minRow, i);
            maxRow = Math.max(maxRow, i);
            minCol = Math.min(minCol, j);
            maxCol = Math.max(maxCol, j);
          }
        }
      }

      if (!hasBlocks) return null;

      for (let row = 0; row <= 8 - (maxRow - minRow + 1); row++) {
        for (let col = 0; col <= 8 - (maxCol - minCol + 1); col++) {
          if (canPlaceFigure(board, figure, { row, col })) {
            const newBoard = placeFigure(board, figure, { row, col });
            const { newBoard: clearedBoard, clearedLines } = checkAndClearLines(newBoard);
            
            const score = evaluateState(clearedBoard);
            
            if (score > bestScore) {
              bestScore = score;
              
              const newSourceMap = sourceMap.map(row => [...row]);
              for (let i = minRow; i <= maxRow; i++) {
                for (let j = minCol; j <= maxCol; j++) {
                  if (figure[i][j] === 1) {
                    const boardRow = row + (i - minRow);
                    const boardCol = col + (j - minCol);
                    if (boardRow >= 0 && boardRow < 8 && boardCol >= 0 && boardCol < 8) {
                      newSourceMap[boardRow][boardCol] = figureIndex;
                    }
                  }
                }
              }
              
              bestStep = {
                figureIndex,
                position: { row, col },
                clearedLines,
                resultBoard: clearedBoard,
                sourceMap: newSourceMap
              };
            }
          }
        }
      }

      return bestStep;
    };

    const bestSteps: SolutionStep[] = [];
    let remainingFigures = [0, 1, 2].filter(index => 
      figures[index].some(row => row.some(cell => cell === 1))
    );

    const getPermutations = (arr: number[]): number[][] => {
      if (arr.length <= 1) return [arr];
      const result: number[][] = [];
      
      for (let i = 0; i < arr.length; i++) {
        const current = arr[i];
        const remaining = [...arr.slice(0, i), ...arr.slice(i + 1)];
        const perms = getPermutations(remaining);
        
        for (const perm of perms) {
          result.push([current, ...perm]);
        }
      }
      
      return result;
    };

    const tryAllPermutations = (figureIndices: number[]): boolean => {
      const permutations = getPermutations(figureIndices);
      
      for (const order of permutations) {
        let tempBoard = currentBoard.map(row => [...row]);
        let tempSourceMap = currentSourceMap.map(row => [...row]);
        let success = true;
        const tempSteps: SolutionStep[] = [];
        
        for (const figureIndex of order) {
          const step = findBestMoveForFigure(
            tempBoard,
            figures[figureIndex],
            figureIndex,
            tempSourceMap
          );
          
          if (step) {
            tempSteps.push(step);
            tempBoard = step.resultBoard;
            tempSourceMap = step.sourceMap;
          } else {
            success = false;
            break;
          }
        }
        
        if (success) {
          bestSteps.push(...tempSteps);
          return true;
        }
      }
      
      return false;
    };

    const isDeadlockDetected = !tryAllPermutations(remainingFigures);
    if (isDeadlockDetected) {
      setUserProgress(prev => ({
        ...prev,
        isDeadlock: true,
        hasError: true,
        errorMessage: "No valid placement found. Try a different layout."
      }));
      return;
    }

    if (bestSteps.length === remainingFigures.length) {
      setSolutionSteps(bestSteps);
      setCurrentStep(0);
      setMainBoard(bestSteps[bestSteps.length - 1].resultBoard);
      
      const newFigures = figures.map((fig, index) => 
        remainingFigures.includes(index) 
          ? Array(5).fill(0).map(() => Array(5).fill(0))
          : fig
      );
      setFigures(newFigures);
      
      if (isNewRound) {
        setUserProgress(prev => ({
          ...prev,
          hasEditedFigure: false,
          hasStartedNewRound: true,
          isDeadlock: false,
          hasError: false,
          errorMessage: ""
        }));
      }
      setIsNewRound(false);
    } else {
      setUserProgress(prev => ({
        ...prev,
        isDeadlock: true,
        hasError: true,
        errorMessage: "No valid placement found. Try a different layout."
      }));
    }
  };

  // 重新开始
  const startNewRound = () => {
    setMainBoard(Array(8).fill(0).map(() => Array(8).fill(0)));
    setFigures([
      Array(5).fill(0).map(() => Array(5).fill(0)),
      Array(5).fill(0).map(() => Array(5).fill(0)),
      Array(5).fill(0).map(() => Array(5).fill(0))
    ]);
    setSolutionSteps([]);
    setIsNewRound(true);
  };

  // 处理拖动相关
  const handleDragStart = (
    board: Board,
    setBoard: (board: Board) => void,
    row: number,
    col: number,
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    setIsDragging(true);
    setIsErasing(board[row][col] === 1);
    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = board[row][col] ? 0 : 1;
    setBoard(newBoard);
  };

  const handleDragOver = (
    board: Board,
    setBoard: (board: Board) => void,
    row: number,
    col: number,
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    if (isDragging) {
      const newBoard = board.map(r => [...r]);
      newBoard[row][col] = isErasing ? 0 : 1;
      setBoard(newBoard);
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  // 用户进度状态
  const [userProgress, setUserProgress] = useState({
    hasEditedMainBoard: false,
    hasEditedFigure: false,
    hasCalculated: false,
    hasStartedNewRound: false,
    isDeadlock: false,
    hasError: false,
    errorMessage: ""
  });

  useEffect(() => {
    if (mainBoard.some(row => row.some(cell => cell === 1))) {
      setUserProgress(prev => ({ ...prev, hasEditedMainBoard: true }));
    }
  }, [mainBoard]);

  useEffect(() => {
    if (figures.some(fig => fig.some(row => row.some(cell => cell === 1)))) {
      setUserProgress(prev => ({ ...prev, hasEditedFigure: true }));
    }
  }, [figures]);

  return (
    <div className="p-3 flex flex-col gap-3">
      {/* Main board */}
      <div className="w-full p-2 sm:p-3 border rounded-lg shadow relative">
        <div className="w-full max-w-[300px] mx-auto">
          <div className="grid grid-cols-8 gap-[1px] bg-gray-100 p-2 rounded">
            {mainBoard.map((row, i) => (
              <React.Fragment key={i}>
                {row.map((cell, j) => (
                  <div
                    key={`${i}-${j}`}
                    className={`w-full aspect-square border ${
                      cell ? 'bg-green-500' : 'bg-white'
                    } cursor-pointer select-none`}
                    onMouseDown={(e) => handleDragStart(mainBoard, setMainBoard, i, j, e)}
                    onMouseEnter={(e) => handleDragOver(mainBoard, setMainBoard, i, j, e)}
                    onMouseUp={handleDragEnd}
                    data-pos={`${i}-${j}`}
                  />
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Figures */}
      <div className="relative mt-4">
        <div className="flex flex-wrap gap-4 justify-center">
          {figures.map((figure, index) => (
            <div 
              key={index}
              className={`border rounded-lg p-2 ${selectedFigureIndex === index ? 'ring-2 ring-blue-500' : ''}`}
              onClick={() => setSelectedFigureIndex(index)}
            >
              <div className="grid grid-cols-5 gap-0.5 bg-gray-100 p-1 rounded">
                {figure.map((row, i) => (
                  <React.Fragment key={i}>
                    {row.map((cell, j) => (
                      <div
                        key={`${i}-${j}`}
                        className={`w-4 sm:w-5 aspect-square border ${
                          cell ? figureColors[index] : 'bg-white'
                        } cursor-pointer select-none`}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleDragStart(
                            figures[index],
                            (newBoard) => {
                              const newFigures = [...figures];
                              newFigures[index] = newBoard;
                              setFigures(newFigures);
                            },
                            i,
                            j,
                            e
                          );
                        }}
                        onMouseEnter={(e) => {
                          if (isDragging) {
                            e.stopPropagation();
                            handleDragOver(
                              figures[index],
                              (newBoard) => {
                                const newFigures = [...figures];
                                newFigures[index] = newBoard;
                                setFigures(newFigures);
                              },
                              i,
                              j,
                              e
                            );
                          }
                        }}
                        data-pos={`${i}-${j}`}
                      />
                    ))}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="relative">
        {userProgress.isDeadlock && (
          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 
                         bg-red-500 text-white px-4 py-1 rounded-full text-sm">
            {userProgress.errorMessage}
          </div>
        )}
        <div className="flex gap-3 justify-center">
          <button 
            className="px-3 py-1.5 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
            onClick={startNewRound}
          >
            New Game
          </button>
          <button 
            className="px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            onClick={calculateSolution}
            disabled={!figures.some(fig => fig.some(row => row.some(cell => cell)))}
          >
            {isNewRound ? 'Calculate Solution' : 'Continue'}
          </button>
        </div>
      </div>

      {/* Solution steps */}
      {solutionSteps.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-bold text-center mb-4">Placement Steps</h3>
          <div className="flex flex-wrap gap-4 justify-center">
            {solutionSteps.map((step, stepIndex) => (
              <div key={stepIndex} className="border rounded-lg p-4 bg-white">
                <div className="text-center mb-2">
                  <div className="font-semibold">Step {stepIndex + 1}</div>
                  {(step.clearedLines.rows.length > 0 || step.clearedLines.cols.length > 0) && (
                    <div className="text-sm text-red-600">
                      {step.clearedLines.rows.length > 0 && 
                        `Clear ${step.clearedLines.rows.length} row${step.clearedLines.rows.length > 1 ? 's' : ''}`}
                      {step.clearedLines.rows.length > 0 && step.clearedLines.cols.length > 0 && ', '}
                      {step.clearedLines.cols.length > 0 && 
                        `Clear ${step.clearedLines.cols.length} column${step.clearedLines.cols.length > 1 ? 's' : ''}`}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-8 gap-[1px] bg-gray-100 p-1">
                  {step.resultBoard.map((row, i) => (
                    <React.Fragment key={i}>
                      {row.map((cell, j) => {
                        const source = step.sourceMap[i][j];
                        const isClearing = 
                          (step.clearedLines.rows.includes(i) || 
                           step.clearedLines.cols.includes(j));
                        const shouldShowCell = cell === 1 || isClearing;
                        const isCurrentPlacement = source === step.figureIndex && source !== -1;

                        return (
                          <div
                            key={`${i}-${j}`}
                            className={`
                              w-4 sm:w-5 aspect-square border
                              ${shouldShowCell ? (
                                `${source === -1 ? 'bg-green-500' : figureColors[source]}
                                 ${isClearing ? 'animate-pulse' : ''}
                                 ${isCurrentPlacement ? 'border-2 border-dashed border-black' : ''}`
                              ) : 'bg-white'}
                            `}
                          />
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BlockBlastSolver;