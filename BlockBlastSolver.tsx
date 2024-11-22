import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'next-i18next';

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

// 添加一个新的类型来追踪每个格子的来源
type CellSource = {
  board: Board;
  sourceMap: number[][];  // -1 表示初始格子，0,1,2 表示由哪个 Figure 放置
};

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

  // 查完整列和接完整列
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

// 在组件顶部添加类型定义
type GameRules = {
  rules: string[];
};

const BlockBlastSolver: React.FC = () => {
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

  // 添加新的状态来跟踪是否是新一轮
  const [isNewRound, setIsNewRound] = useState<boolean>(true);

  // 添加拖动相关的状态
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isErasing, setIsErasing] = useState<boolean>(false); // 用于判断是填充还是擦除

  // 定义 figure 颜色映射
  const figureColors = ['bg-red-500', 'bg-yellow-500', 'bg-blue-500'];
  
  // 添加 toggleCell 函数
  const toggleCell = (
    board: Board,
    setBoard: (board: Board) => void,
    row: number,
    col: number
  ): void => {
    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = newBoard[row][col] ? 0 : 1;
    setBoard(newBoard);
  };

  // 检查是否可以消除行或列
  const checkAndClearLines = (board: Board): { newBoard: Board; clearedLines: ClearedLines } => {
    const newBoard = board.map(row => [...row]);
    const clearedLines: ClearedLines = { rows: [], cols: [] };
    
    // 检查行
    for (let i = 0; i < 8; i++) {
      if (newBoard[i].every(cell => cell === 1)) {
        clearedLines.rows.push(i);
        // 不立即清除行
      }
    }
    
    // 检查列
    for (let j = 0; j < 8; j++) {
      if (newBoard.every(row => row[j] === 1)) {
        clearedLines.cols.push(j);
        // 不立即清除列
      }
    }

    // 只在需要实际更新棋盘状态时清除
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
    // 首先找到figure的实际大小
    let minRow = 4, maxRow = 0, minCol = 4, maxCol = 0;
    let hasBlocks = false;
    
    // 修改这里：直接遍历整个figure寻找有效块
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

    // 如果figure是空的，返回false
    if (!hasBlocks) return false;

    // 修改边界检查：使用实际大小
    const figureHeight = maxRow - minRow + 1;
    const figureWidth = maxCol - minCol + 1;
    
    // 检查是否超出边界
    if (pos.row + figureHeight > 8 || pos.col + figureWidth > 8) return false;

    // 检查是否与现有方块重叠：只检查实际有方块的位置
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

  // 修改 placeFigure 函数
  const placeFigure = (board: Board, figure: Board, pos: Position): Board => {
    // 首先找到figure的实际大小
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
    
    // 只遍历实际有方块的范围，并计算相对位置
    for (let i = minRow; i <= maxRow; i++) {
      for (let j = minCol; j <= maxCol; j++) {
        if (figure[i][j] === 1) {
          const boardRow = pos.row + (i - minRow);
          const boardCol = pos.col + (j - minCol);
          // 添加边界检查
          if (boardRow >= 0 && boardRow < 8 && boardCol >= 0 && boardCol < 8) {
            newBoard[boardRow][boardCol] = 1;
          }
        }
      }
    }
    
    return newBoard;
  };

  // 修改 calculateSolution 函数
  const calculateSolution = (): void => {
    console.group('Calculate Solution Start');
    console.log('Current Main Board:');
    console.table(mainBoard);

    // 使用当前主棋盘状态
    let currentBoard = mainBoard.map(row => [...row]);
    let initialSourceMap = Array(8).fill(0).map(() => Array(8).fill(-1));
    
    // 如果不是新一轮，从最后一步的结果开始
    if (!isNewRound && solutionSteps.length > 0) {
      const lastStep = solutionSteps[solutionSteps.length - 1];
      currentBoard = lastStep.resultBoard.map(row => [...row]);
      console.log('Using last step board:', currentBoard);
    }

    // 确保在每次新计算时重置 sourceMap
    let currentSourceMap = initialSourceMap.map(row => [...row]);

    // 获取列的填充数量
    const getColumnFillCounts = (board: Board): number[] => {
      const counts = Array(8).fill(0);
      for (let col = 0; col < 8; col++) {
        counts[col] = board.reduce((count, row) => count + (row[col] ? 1 : 0), 0);
      }
      return counts;
    };

    // 找到单个 figure 的最佳位置
    const findBestMoveForFigure = (
      board: Board,
      figure: Board,
      figureIndex: number,
      sourceMap: number[][]
    ): SolutionStep | null => {
      console.group(`Finding best move for figure ${figureIndex}`);
      let bestScore = -Infinity;
      let bestStep: SolutionStep | null = null;
      
      // 首先找到figure的实际大小
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

      console.log('Figure dimensions:', {
        minRow,
        maxRow,
        minCol,
        maxCol,
        hasBlocks
      });

      if (!hasBlocks) {
        console.log('Empty figure, skipping');
        console.groupEnd();
        return null;
      }

      // 尝试所有可能的位置
      let attemptCount = 0;
      let validPlacementCount = 0;

      for (let row = 0; row <= 8 - (maxRow - minRow + 1); row++) {
        for (let col = 0; col <= 8 - (maxCol - minCol + 1); col++) {
          attemptCount++;
          if (canPlaceFigure(board, figure, { row, col })) {
            validPlacementCount++;
            const newBoard = placeFigure(board, figure, { row, col });
            const { newBoard: clearedBoard, clearedLines } = checkAndClearLines(newBoard);
            
            // 计算分数
            const score = evaluateState(clearedBoard);
            
            if (score > bestScore) {
              console.log(`New best score ${score} at position:`, { row, col });
              bestScore = score;
              
              // 修改这里：使用相对位置更新 sourceMap
              const newSourceMap = sourceMap.map(row => [...row]);
              for (let i = minRow; i <= maxRow; i++) {
                for (let j = minCol; j <= maxCol; j++) {
                  if (figure[i][j] === 1) {
                    const boardRow = row + (i - minRow);
                    const boardCol = col + (j - minCol);
                    // 添加边界检查
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

      console.log(`Attempted ${attemptCount} positions, found ${validPlacementCount} valid placements`);
      console.log('Best score:', bestScore);
      console.log('Best step:', bestStep);
      console.groupEnd();
      return bestStep;
    };

    // 修改处理 figures 的逻辑
    const bestSteps: SolutionStep[] = [];
    let remainingFigures = [0, 1, 2].filter(index => 
      figures[index].some(row => row.some(cell => cell === 1))
    );

    console.log('Available Figures:', remainingFigures);
    remainingFigures.forEach(index => {
      console.log(`Figure ${index}:`);
      console.table(figures[index]);
    });

    // 在 tryAllPermutations 函数中添加日志
    const tryAllPermutations = (figureIndices: number[]): boolean => {
      const permutations = getPermutations(figureIndices);
      console.log('Trying permutations:', permutations);
      
      for (const order of permutations) {
        console.group(`Trying order: ${order.join(',')}`);
        let tempBoard = currentBoard.map(row => [...row]);
        let tempSourceMap = currentSourceMap.map(row => [...row]);
        let success = true;
        const tempSteps: SolutionStep[] = [];
        
        for (const figureIndex of order) {
          console.log(`Attempting to place figure ${figureIndex}`);
          const step = findBestMoveForFigure(
            tempBoard,
            figures[figureIndex],
            figureIndex,
            tempSourceMap
          );
          
          if (step) {
            console.log(`Successfully placed figure ${figureIndex} at position:`, step.position);
            console.log('Resulting board:');
            console.table(step.resultBoard);
            tempSteps.push(step);
            tempBoard = step.resultBoard;
            tempSourceMap = step.sourceMap;
          } else {
            console.log(`Failed to place figure ${figureIndex}`);
            success = false;
            break;
          }
        }
        
        if (success) {
          console.log('Found valid solution with order:', order);
          bestSteps.push(...tempSteps);
          console.groupEnd();
          return true;
        }
        console.groupEnd();
      }
      
      console.log('No valid placement found for any permutation');
      return false;
    };

    // 获取所有可能的排列
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

    // 尝试所有可能的放置顺序
    const isDeadlockDetected = !tryAllPermutations(remainingFigures);
    if (isDeadlockDetected) {
      console.log('Deadlock detected');
      setUserProgress(prev => ({
        ...prev,
        isDeadlock: true,
        hasError: true,
        errorMessage: "Could not find valid placements for the figures. Try a different arrangement."
      }));
      return;
    }

    console.groupEnd();
    // 修改这里: 检查是否找到解决方案时使用实际的figure数量
    if (bestSteps.length === remainingFigures.length) {
      setSolutionSteps(bestSteps);
      setCurrentStep(0);
      setMainBoard(bestSteps[bestSteps.length - 1].resultBoard);
      
      // 只清空已使用的figure
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
        errorMessage: "Could not find valid placements for the figures. Try a different arrangement."
      }));
    }
  };

  // 添加重新开始函数
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

  // 处理拖开始
  const handleDragStart = (
    board: Board,
    setBoard: (board: Board) => void,
    row: number,
    col: number,
    e: React.MouseEvent
  ) => {
    e.preventDefault(); // 防止默认的拖动行为
    setIsDragging(true);
    // 根据点击的格子状态决定是填充还是擦除
    setIsErasing(board[row][col] === 1);
    toggleCell(board, setBoard, row, col);
  };

  // 处理拖动过程中的移动
  const handleDragOver = (
    board: Board,
    setBoard: (board: Board) => void,
    row: number,
    col: number,
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    if (isDragging) {
      // 根 isErasing 决是填充还是擦除
      const newBoard = board.map(r => [...r]);
      newBoard[row][col] = isErasing ? 0 : 1;
      setBoard(newBoard);
    }
  };

  // 处理拖动结束
  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // 添加全局鼠标事件监听
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  // 添加用户进度追踪状态
  const [userProgress, setUserProgress] = useState({
    hasEditedMainBoard: false,
    hasEditedFigure: false,
    hasCalculated: false,
    hasStartedNewRound: false,
    isDeadlock: false  // 添加死局状态
  });

  // 监听用户操作更新进度
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

  // 修改动画样式
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes clearLine {
        0% {
          opacity: 1;
          transform: scale(1);
          background-color: inherit;
        }
        50% {
          opacity: 0.6;
          transform: scale(0.98);
          background-color: #ef4444;
        }
        100% {
          opacity: 1;
          transform: scale(1);
          background-color: inherit;
        }
      }
      .clearing-cell {
        animation: clearLine 2s ease-in-out infinite;
        animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
      }
      .clearing-cell-enter {
        opacity: 1;
        transform: scale(1);
      }
    `;
    document.head.appendChild(style);

    // 修改清理函数，确保返回类型正确
    const cleanup = () => {
      document.head.removeChild(style);
    };
    
    return cleanup;
  }, []);

  const stepsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (solutionSteps.length > 0 && stepsRef.current) {
      stepsRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [solutionSteps]);

  return (
    <div className="p-4 flex flex-col gap-4">
      

      {/* Main board area */}
      <div className="w-full p-2 sm:p-4 border rounded-lg shadow relative">
        {!userProgress.hasEditedMainBoard && (
          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 
                         bg-blue-500 text-white px-4 py-1 rounded-full text-sm
                         animate-bounce">
            {t('blockBlastSolver.interactions.clickOrDrag')}
          </div>
        )}
        <div className="w-full max-w-[400px] mx-auto">
          <div className="grid grid-cols-8 gap-[2px] bg-gray-100 p-2 rounded">
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
                    onTouchStart={(e) => {
                      e.preventDefault();
                      handleDragStart(mainBoard, setMainBoard, i, j, e as unknown as React.MouseEvent);
                    }}
                    onTouchMove={(e) => {
                      e.preventDefault();
                      const touch = e.touches[0];
                      const element = document.elementFromPoint(touch.clientX, touch.clientY);
                      if (element) {
                        const [row, col] = element.getAttribute('data-pos')?.split('-').map(Number) || [-1, -1];
                        if (row !== -1 && col !== -1) {
                          handleDragOver(mainBoard, setMainBoard, row, col, e as unknown as React.MouseEvent);
                        }
                      }
                    }}
                    onTouchEnd={handleDragEnd}
                    data-pos={`${i}-${j}`}
                  />
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Figure editing area */}
      <div className="relative mt-4">
        {userProgress.hasEditedMainBoard && !userProgress.hasEditedFigure && (
          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 
                         bg-blue-500 text-white px-4 py-1 rounded-full text-sm
                         animate-bounce">
            {t('blockBlastSolver.interactions.designFigures')}
          </div>
        )}
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
                        className={`w-5 sm:w-6 aspect-square border ${
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
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleDragStart(
                            figures[index],
                            (newBoard) => {
                              const newFigures = [...figures];
                              newFigures[index] = newBoard;
                              setFigures(newFigures);
                            },
                            i,
                            j,
                            e as unknown as React.MouseEvent
                          );
                        }}
                        onTouchMove={(e) => {
                          if (isDragging) {
                            e.stopPropagation();
                            e.preventDefault();
                            const touch = e.touches[0];
                            const element = document.elementFromPoint(touch.clientX, touch.clientY);
                            if (element) {
                              const [row, col] = element.getAttribute('data-pos')?.split('-').map(Number) || [-1, -1];
                              if (row !== -1 && col !== -1) {
                                handleDragOver(
                                  figures[index],
                                  (newBoard) => {
                                    const newFigures = [...figures];
                                    newFigures[index] = newBoard;
                                    setFigures(newFigures);
                                  },
                                  row,
                                  col,
                                  e as unknown as React.MouseEvent
                                );
                              }
                            }
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

      {/* Action buttons area */}
      <div className="relative">
        {userProgress.isDeadlock && (
          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 
                         bg-red-500 text-white px-4 py-1 rounded-full text-sm
                         animate-bounce">
            {t('blockBlastSolver.interactions.noValidPlacement')}
          </div>
        )}
        {/* 只在新一轮的第一次计算后显示提示 */}
        {userProgress.hasStartedNewRound && !userProgress.hasEditedFigure && isNewRound && (
          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 
                         bg-blue-500 text-white px-4 py-1 rounded-full text-sm
                         animate-bounce">
            {t('blockBlastSolver.interactions.continueDesigning')}
          </div>
        )}
        <div className="flex gap-4 justify-center">
          <button 
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
            onClick={startNewRound}
          >
            {t('blockBlastSolver.interactions.newGame')}
          </button>
          <button 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            onClick={calculateSolution}
            disabled={!figures.some(fig => fig.some(row => row.some(cell => cell)))}
          >
            {isNewRound ? t('blockBlastSolver.interactions.calculate') : t('blockBlastSolver.interactions.continue')}
          </button>
        </div>

      </div>

      {/* Solution display area */}
      {solutionSteps.length > 0 && (
        <div ref={stepsRef} className="mt-16 px-2">
          <h3 className="text-2xl font-bold text-center mb-8">
            {t('blockBlastSolver.solution.steps')}
          </h3>
          <div className="flex flex-col sm:flex-row gap-8 items-center justify-center">
            {solutionSteps.map((step, stepIndex) => (
              <div key={stepIndex} className="flex flex-col items-center w-full sm:w-[300px]">
                <div className="text-center mb-4">
                  <div className="text-xl font-semibold mb-2">
                    {t('blockBlastSolver.solution.step', { step: stepIndex + 1 })}
                  </div>
                  {(step.clearedLines.rows.length > 0 || step.clearedLines.cols.length > 0) && (
                    <div className="text-sm text-red-600 font-semibold">
                      {step.clearedLines.rows.length > 0 && 
                        t('blockBlastSolver.solution.clearRows', { count: step.clearedLines.rows.length })}
                      {step.clearedLines.rows.length > 0 && step.clearedLines.cols.length > 0 && '，'}
                      {step.clearedLines.cols.length > 0 && 
                        t('blockBlastSolver.solution.clearCols', { count: step.clearedLines.cols.length })}
                    </div>
                  )}
                </div>
                <div className="border rounded-lg p-4 bg-white w-full">
                  <div className="grid grid-cols-8 gap-1 bg-gray-100 p-2">
                    {step.resultBoard.map((row, i) => (
                      <React.Fragment key={i}>
                        {row.map((cell, j) => {
                          const source = step.sourceMap[i][j];
                          const isClearing = 
                            (step.clearedLines.rows.includes(i) || 
                             step.clearedLines.cols.includes(j));
                          const shouldShowCell = cell === 1 || isClearing;

                          // 修改判断逻辑：只有当前步骤新放置的方块才显示虚线
                          const isCurrentPlacement = source === step.figureIndex && source !== -1;

                          return (
                            <div
                              key={`${i}-${j}`}
                              className={`
                                w-full aspect-square border
                                ${shouldShowCell ? (
                                  `${source === -1 ? 'bg-green-500' : figureColors[source]}
                                   ${isClearing ? 'clearing-cell clearing-cell-enter' : ''}
                                   ${isCurrentPlacement ? 'border-4 border-dashed border-black shadow-lg' : ''}`
                                ) : 'bg-white'}
                                transition-all duration-300
                              `}
                              style={{
                                animationDelay: isClearing ? `${(i + j) * 50}ms` : '0ms'
                              }}
                            />
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Play Game CTA */}
          <div className="mt-16 text-center bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 p-1 rounded-2xl">
            <div className="bg-white rounded-xl px-6 py-8">
              <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                {t('blockBlastSolver.playGame.title')}
              </h3>
              <p className="text-gray-600 mb-6">
                {t('blockBlastSolver.playGame.description')}
              </p>
              <a
                href="https://blockblastgame.net/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-semibold text-white transition-all duration-200 
                           bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-xl
                           hover:scale-105 hover:shadow-lg active:scale-100"
              >
                {t('blockBlastSolver.playGame.button')}
                <svg 
                  className="w-5 h-5" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth="2" 
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </a>
              <p className="mt-4 text-sm text-gray-500">
                {t('blockBlastSolver.playGame.subtext')}
              </p>
            </div>
          </div>
        
        </div>

      )}
        {/* Instructions */}
<div className="mb-6 bg-white rounded-lg shadow p-4">
        <h1 className="text-xl font-bold mb-3 text-gray-800">
          {t('blockBlastSolver.title')}
        </h1>
        <div className="space-y-4">
          <div className="text-gray-600">
            <p className="mb-2">{t('blockBlastSolver.description')}</p>
            <ol className="list-decimal list-inside space-y-2">
              <li className={`${userProgress.hasEditedMainBoard ? 'text-green-600' : ''}`}>
                {t('blockBlastSolver.steps.step1')}
              </li>
              <li className={`${userProgress.hasEditedFigure ? 'text-green-600' : ''}`}>
                {t('blockBlastSolver.steps.step2')}
              </li>
              <li className={`${userProgress.hasCalculated ? 'text-green-600' : ''}`}>
                {t('blockBlastSolver.steps.step3')}
              </li>
            </ol>
          </div>
          <div className="text-sm text-gray-500">
            <p className="font-medium mb-1">{t('blockBlastSolver.gameRules.title')}</p>
            <ul className="list-disc list-inside space-y-1">
              {(t('blockBlastSolver.gameRules', { returnObjects: true }) as GameRules).rules.map((rule, index) => (
                <li key={index}>{rule}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlockBlastSolver;