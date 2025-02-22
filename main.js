document.addEventListener("DOMContentLoaded", () => {
    const board = document.getElementById("game-board");
    const width = 8;
    const squares = [];
    const candyColors = ["red", "blue", "green", "yellow", "purple", "orange"];
  
    let selectedCandy = null;
    let selectedCandyId = null;
    let touchStartX = 0, touchStartY = 0, touchEndX = 0, touchEndY = 0;
  
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
        square.addEventListener("drop", dragDrop);
        square.addEventListener("dragend", dragEnd);
        square.addEventListener("touchstart", touchStart);
        square.addEventListener("touchmove", touchMove);
        square.addEventListener("touchend", touchEnd);
      }
    }
  
    function getRandomColor() {
      return candyColors[Math.floor(Math.random() * candyColors.length)];
    }
  
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
        selectedCandyId - 1, selectedCandyId + 1,
        selectedCandyId - width, selectedCandyId + width
      ];
      if (validMoves.includes(targetCandyId)) {
        swapCandies(targetCandyId);
      }
    }
  
    function dragEnd() {
      setTimeout(checkMatches, 100);
    }
  
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
        if (dx > 10) targetCandyId = selectedCandyId + 1;
        else if (dx < -10) targetCandyId = selectedCandyId - 1;
      } else {
        if (dy > 10) targetCandyId = selectedCandyId + width;
        else if (dy < -10) targetCandyId = selectedCandyId - width;
      }
      if (targetCandyId !== null && targetCandyId >= 0 && targetCandyId < width * width) {
        swapCandies(targetCandyId);
      }
    }
  
    function swapCandies(targetCandyId) {
      let targetCandyColor = squares[targetCandyId].classList[1];
      let selectedCandyColor = selectedCandy.classList[1];
      squares[targetCandyId].classList.replace(targetCandyColor, selectedCandyColor);
      selectedCandy.classList.replace(selectedCandyColor, targetCandyColor);
      setTimeout(checkMatches, 100);
    }
  
    function checkMatches() {
      for (let i = 0; i < width * width; i++) {
        let color = squares[i].classList[1];
        if (!color) continue;
  
        let rowCheck = [i, i + 1, i + 2];
        if (i % width < width - 2 && rowCheck.every(index => squares[index]?.classList[1] === color)) {
          rowCheck.forEach(index => squares[index].classList.add("match"));
        }
  
        let columnCheck = [i, i + width, i + width * 2];
        if (i < width * (width - 2) && columnCheck.every(index => squares[index]?.classList[1] === color)) {
          columnCheck.forEach(index => squares[index].classList.add("match"));
        }
  
        let specialCheck = [i, i + 1, i + 2, i + 3];
        if (i % width < width - 3 && specialCheck.every(index => squares[index]?.classList[1] === color)) {
          squares[i].classList.replace(color, "striped");
        }
      }
      setTimeout(dropCandies, 100);
    }
  
    function dropCandies() {
      for (let i = width * width - 1; i >= 0; i--) {
        if (squares[i].classList.contains("match")) {
          squares[i].className = `candy ${getRandomColor()}`;
          squares[i].setAttribute("draggable", true);
        }
      }
      setTimeout(checkMatches, 100);
    }
  
    createBoard();
  });
  