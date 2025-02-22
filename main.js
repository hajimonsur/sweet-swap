document.addEventListener("DOMContentLoaded", () => {
  const board = document.getElementById("game-board");
  const width = 8;
  const squares = [];
  const candyColors = ["red", "blue", "green", "yellow", "purple", "orange"];

  let selectedCandy = null;
  let selectedCandyId = null;

  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;

  // Create the game board
  function createBoard() {
    for (let i = 0; i < width * width; i++) {
      const square = document.createElement("div");
      square.setAttribute("id", i);
      square.setAttribute("draggable", true);
      square.classList.add("candy", getRandomColor());
      board.appendChild(square);
      squares.push(square);

      // Drag and drop event listeners (for computers)
      square.addEventListener("dragstart", dragStart);
      square.addEventListener("dragover", dragOver);
      square.addEventListener("drop", dragDrop);
      square.addEventListener("dragend", dragEnd);

      // Touch event listeners (for mobile)
      square.addEventListener("touchstart", touchStart);
      square.addEventListener("touchmove", touchMove);
      square.addEventListener("touchend", touchEnd);
    }
  }

  function getRandomColor() {
    return candyColors[Math.floor(Math.random() * candyColors.length)];
  }

  // Drag and drop functions
  function dragStart() {
    selectedCandy = this;
    selectedCandyId = parseInt(this.id);
  }

  function dragOver(e) {
    e.preventDefault();
  }

  function dragDrop() {
    let targetCandyId = parseInt(this.id);
    let validMoves = [
      selectedCandyId - 1,
      selectedCandyId + 1,
      selectedCandyId - width,
      selectedCandyId + width,
    ];

    if (validMoves.includes(targetCandyId)) {
      swapCandies(targetCandyId);
    }
  }

  function dragEnd() {
    setTimeout(checkMatches, 100);
  }

  // Touch functions for mobile swipe
  function touchStart(e) {
    e.preventDefault();
    selectedCandy = this;
    selectedCandyId = parseInt(this.id);

    let touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }

  function touchMove(e) {
    e.preventDefault();
    let touch = e.touches[0];
    touchEndX = touch.clientX;
    touchEndY = touch.clientY;
  }

  function touchEnd(e) {
    e.preventDefault();

    let dx = touchEndX - touchStartX;
    let dy = touchEndY - touchStartY;
    let targetCandyId = null;

    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal swipe
      if (dx > 10) targetCandyId = selectedCandyId + 1; // Swipe Right
      else if (dx < -10) targetCandyId = selectedCandyId - 1; // Swipe Left
    } else {
      // Vertical swipe
      if (dy > 10) targetCandyId = selectedCandyId + width; // Swipe Down
      else if (dy < -10) targetCandyId = selectedCandyId - width; // Swipe Up
    }

    if (
      targetCandyId !== null &&
      targetCandyId >= 0 &&
      targetCandyId < width * width
    ) {
      swapCandies(targetCandyId);
    }
  }

  // Swap candies
  function swapCandies(targetCandyId) {
    let targetCandyColor = squares[targetCandyId].classList[1];
    let selectedCandyColor = selectedCandy.classList[1];

    squares[targetCandyId].classList.replace(
      targetCandyColor,
      selectedCandyColor
    );
    selectedCandy.classList.replace(selectedCandyColor, targetCandyColor);

    setTimeout(checkMatches, 100);
  }

  // Check for matches of 3 or more
  function checkMatches() {
    for (let i = 0; i < width * width; i++) {
      let color = squares[i].classList[1];

      if (!color) continue;

      // Check horizontal matches
      if (i % width < width - 2) {
        let rowCheck = [i, i + 1, i + 2];
        if (rowCheck.every((index) => squares[index]?.classList[1] === color)) {
          rowCheck.forEach((index) => squares[index].classList.remove(color));
        }
      }

      // Check vertical matches
      if (i < width * (width - 2)) {
        let columnCheck = [i, i + width, i + width * 2];
        if (
          columnCheck.every((index) => squares[index]?.classList[1] === color)
        ) {
          columnCheck.forEach((index) =>
            squares[index].classList.remove(color)
          );
        }
      }
    }

    setTimeout(dropCandies, 100);
  }

  // Drop candies down and refill
  function dropCandies() {
    for (let i = width * width - 1; i >= 0; i--) {
      if (!squares[i].classList[1]) {
        if (i >= width) {
          squares[i].className = squares[i - width].className;
          squares[i - width].className = "candy";
        } else {
          squares[i].className = `candy ${getRandomColor()}`;
        }

        squares[i].setAttribute("draggable", true); // Ensure new candies are draggable
      }
    }

    setTimeout(checkMatches, 100);
  }

  createBoard();
});
