document.addEventListener("DOMContentLoaded", () => {
    const board = document.getElementById("game-board");
    const scoreDisplay = document.getElementById("score");
    const timerDisplay = document.getElementById("timer");
    const highScoreDisplay = document.getElementById("high-score");

    const width = 8;
    const squares = [];
    const candyColors = ["red", "blue", "green", "yellow", "purple", "orange"];
    let score = 0;
    let timeLeft = 180;
    let timer;
    let highScore = localStorage.getItem("highScore") || 0;

    let draggedElement = null;
    let draggedIndex = null;
    let touchStartX = 0;
    let touchStartY = 0;

    highScoreDisplay.textContent = highScore;

    function updateScore(points) {
        score += points;
        scoreDisplay.textContent = score;
    }

    function startTimer() {
        timer = setInterval(() => {
            if (timeLeft > 0) {
                timeLeft--;
                timerDisplay.textContent = timeLeft;
            } else {
                clearInterval(timer);
                endGame();
            }
        }, 1000);
    }

    function endGame() {
        alert(`Game Over! Your final score: ${score}`);

        if (score > highScore) {
            localStorage.setItem("highScore", score);
            highScoreDisplay.textContent = score;
            alert("New High Score! 🎉");
        }

        resetGame();
    }

    function resetGame() {
        score = 0;
        timeLeft = 180;
        scoreDisplay.textContent = score;
        timerDisplay.textContent = timeLeft;
        squares.forEach(square => square.className = `candy ${getRandomColor()}`);
        startTimer();
    }

    function createBoard() {
        for (let i = 0; i < width * width; i++) {
            const square = document.createElement("div");
            square.setAttribute("id", i);
            square.classList.add("candy", getRandomColor());
            square.setAttribute("draggable", true);

            // Drag events for desktop
            square.addEventListener("dragstart", dragStart);
            square.addEventListener("dragover", dragOver);
            square.addEventListener("drop", dragDrop);
            square.addEventListener("dragend", dragEnd);

            // Touch events for mobile
            square.addEventListener("touchstart", touchStart);
            square.addEventListener("touchend", touchEnd);

            board.appendChild(square);
            squares.push(square);
        }
        setTimeout(checkMatches, 100);
    }

    function getRandomColor() {
        return candyColors[Math.floor(Math.random() * candyColors.length)];
    }

    function dragStart(event) {
        draggedElement = this;
        draggedIndex = parseInt(this.id);
    }

    function dragOver(event) {
        event.preventDefault();
    }

    function dragDrop(event) {
        event.preventDefault();
        let targetElement = this;
        let targetIndex = parseInt(this.id);

        swapCandies(draggedIndex, targetIndex);
    }

    function dragEnd() {
        draggedElement = null;
        draggedIndex = null;
    }

    function touchStart(event) {
        let touch = event.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        draggedIndex = parseInt(event.target.id);
    }

    function touchEnd(event) {
        let touch = event.changedTouches[0];
        let touchEndX = touch.clientX;
        let touchEndY = touch.clientY;

        let diffX = touchEndX - touchStartX;
        let diffY = touchEndY - touchStartY;
        let targetIndex = null;

        if (Math.abs(diffX) > Math.abs(diffY)) {
            // Horizontal Swipe
            if (diffX > 0) targetIndex = draggedIndex + 1; // Swipe Right
            else targetIndex = draggedIndex - 1; // Swipe Left
        } else {
            // Vertical Swipe
            if (diffY > 0) targetIndex = draggedIndex + width; // Swipe Down
            else targetIndex = draggedIndex - width; // Swipe Up
        }

        if (targetIndex !== null && targetIndex >= 0 && targetIndex < width * width) {
            swapCandies(draggedIndex, targetIndex);
        }
    }

    function swapCandies(index1, index2) {
        const validMoves = [index1 - 1, index1 + 1, index1 - width, index1 + width];

        if (validMoves.includes(index2)) {
            let color1 = squares[index1].classList[1];
            let color2 = squares[index2].classList[1];

            squares[index1].className = `candy ${color2}`;
            squares[index2].className = `candy ${color1}`;

            setTimeout(checkMatches, 200);
        }
    }

    function checkMatches() {
        let totalPoints = 0;
        let matches = new Set();

        for (let i = 0; i < width * width; i++) {
            let color = squares[i].classList[1];
            if (!color) continue;

            let rowMatch = [i];
            for (let j = 1; j < 5; j++) {
                let next = i + j;
                if (next % width === 0 || squares[next]?.classList[1] !== color) break;
                rowMatch.push(next);
            }

            if (rowMatch.length >= 3) {
                rowMatch.forEach(index => matches.add(index));
                totalPoints += rowMatch.length === 3 ? 3 : rowMatch.length === 4 ? 5 : 10;
            }

            let colMatch = [i];
            for (let j = 1; j < 5; j++) {
                let next = i + j * width;
                if (next >= width * width || squares[next]?.classList[1] !== color) break;
                colMatch.push(next);
            }

            if (colMatch.length >= 3) {
                colMatch.forEach(index => matches.add(index));
                totalPoints += colMatch.length === 3 ? 3 : colMatch.length === 4 ? 5 : 10;
            }
        }

        if (matches.size > 0) {
            matches.forEach(index => {
                squares[index].classList.remove(squares[index].classList[1]);
                squares[index].classList.add("empty");
            });

            updateScore(totalPoints);
            setTimeout(dropCandies, 300);
        }
    }

    function dropCandies() {
        for (let i = width * width - 1; i >= 0; i--) {
            if (squares[i].classList.contains("empty")) {
                let aboveIndex = i - width;
                while (aboveIndex >= 0 && squares[aboveIndex].classList.contains("empty")) {
                    aboveIndex -= width;
                }
                if (aboveIndex >= 0) {
                    squares[i].className = squares[aboveIndex].className;
                    squares[aboveIndex].className = "candy empty";
                } else {
                    squares[i].className = `candy ${getRandomColor()}`;
                }
            }
        }
        setTimeout(checkMatches, 100);
    }

    createBoard();
    startTimer();
});
