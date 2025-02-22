document.addEventListener("DOMContentLoaded", () => {
    const board = document.getElementById("game-board");
    const width = 8;
    const squares = [];
    const candyColors = ["red", "blue", "green", "yellow", "purple", "orange"];
  
    let selectedCandy = null;
    let selectedCandyId = null;
  
    // Create the game board
    function createBoard() {
      for (let i = 0; i < width * width; i++) {
        const square = document.createElement("div");
        square.setAttribute("id", i);
        square.setAttribute("draggable", true);
        square.classList.add("candy", getRandomColor());
        board.appendChild(square);
        squares.push(square);
  
        square.addEventListener("dragstart", dragStart);
        square.addEventListener("dragover", dragOver);
        square.addEventListener("dragenter", dragEnter);
        square.addEventListener("dragleave", dragLeave);
        square.addEventListener("drop", dragDrop);
        square.addEventListener("dragend", dragEnd);
      }
    }
  
    function getRandomColor() {
      return candyColors[Math.floor(Math.random() * candyColors.length)];
    }
  
    // Drag and drop events
    function dragStart() {
      selectedCandy = this;
      selectedCandyId = parseInt(this.id);
    }
  
    function dragOver(e) {
      e.preventDefault();
    }
  
    function dragEnter(e) {
      e.preventDefault();
    }
  
    function dragLeave() {}
  
    function dragDrop() {
      let targetCandyId = parseInt(this.id);
      let validMoves = [
        selectedCandyId - 1,
        selectedCandyId + 1,
        selectedCandyId - width,
        selectedCandyId + width,
      ];
  
      if (validMoves.includes(targetCandyId)) {
        // Swap colors
        let targetCandyColor = squares[targetCandyId].classList[1];
        let selectedCandyColor = selectedCandy.classList[1];
  
        squares[targetCandyId].classList.replace(targetCandyColor, selectedCandyColor);
        selectedCandy.classList.replace(selectedCandyColor, targetCandyColor);
  
        setTimeout(checkMatches, 100);
      }
    }
  
    function dragEnd() {
      setTimeout(checkMatches, 100);
    }
  
    // Check for matches of 3 or more
    function checkMatches() {
      for (let i = 0; i < width * width; i++) {
        let color = squares[i].classList[1];
  
        // Ensure the square exists and has a color
        if (!color) continue;
  
        // Check horizontal matches
        if (i % width < width - 2) {
          let rowCheck = [i, i + 1, i + 2];
          if (rowCheck.every(index => squares[index]?.classList[1] === color)) {
            rowCheck.forEach(index => squares[index].classList.remove(color));
          }
        }
  
        // Check vertical matches
        if (i < width * (width - 2)) {
          let columnCheck = [i, i + width, i + width * 2];
          if (columnCheck.every(index => squares[index]?.classList[1] === color)) {
            columnCheck.forEach(index => squares[index].classList.remove(color));
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
            // Move candy down
            squares[i].className = squares[i - width].className;
            squares[i - width].className = "candy";
          } else {
            // Fill top row with new candies
            squares[i].className = `candy ${getRandomColor()}`;
          }
        }
      }
  
      setTimeout(checkMatches, 100);
    }
  
    createBoard();
  });
  