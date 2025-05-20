document.addEventListener('DOMContentLoaded', () => {
    const gameBoard = document.getElementById('game-board');
    const remainingCardsElement = document.getElementById('remaining-cards');
    const attemptsElement = document.getElementById('attempts');
    const timerElement = document.getElementById('timer');
    const scoreElement = document.getElementById('score');
    const gameStatusElement = document.getElementById('game-status');
    const restartButton = document.getElementById('restart-button');
    const newGameButton = document.getElementById('new-game-button');
    const rankingList = document.getElementById('ranking-list');
    const rankingTabs = document.querySelectorAll('.ranking-tab');

    let cards = [];
    let flippedCards = [];
    let attempts = 0;
    let remainingCards = 16;
    let score = 0;
    let timer = null;
    let seconds = 0;
    let isGameActive = false;
    let currentRankingTab = 'daily';

    // 絵文字の配列（8ペア）
    const emojis = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼'];

    // ランキングデータの管理
    const RankingManager = {
        getRankings(type) {
            const rankings = JSON.parse(localStorage.getItem(`rankings_${type}`) || '[]');
            return rankings.sort((a, b) => b.score - a.score);
        },

        addScore(score, attempts, time) {
            const today = new Date().toISOString().split('T')[0];
            const scoreData = {
                score,
                attempts,
                time,
                date: new Date().toISOString()
            };

            // 日別ランキングの更新
            let dailyRankings = this.getRankings('daily');
            const todayRankings = dailyRankings.filter(r => r.date.startsWith(today));
            if (todayRankings.length < 10 || score > todayRankings[todayRankings.length - 1].score) {
                dailyRankings = dailyRankings.filter(r => !r.date.startsWith(today));
                dailyRankings.push(scoreData);
                dailyRankings.sort((a, b) => b.score - a.score);
                dailyRankings = dailyRankings.slice(0, 10);
                localStorage.setItem('rankings_daily', JSON.stringify(dailyRankings));
            }

            // 全期間ランキングの更新
            let allRankings = this.getRankings('all');
            if (allRankings.length < 10 || score > allRankings[allRankings.length - 1].score) {
                allRankings.push(scoreData);
                allRankings.sort((a, b) => b.score - a.score);
                allRankings = allRankings.slice(0, 10);
                localStorage.setItem('rankings_all', JSON.stringify(allRankings));
            }

            this.updateRankingDisplay();
        },

        updateRankingDisplay() {
            const rankings = this.getRankings(currentRankingTab);
            rankingList.innerHTML = '';

            if (rankings.length === 0) {
                rankingList.innerHTML = '<div class="ranking-item">まだ記録がありません</div>';
                return;
            }

            rankings.forEach((rank, index) => {
                const date = new Date(rank.date);
                const formattedDate = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
                
                const rankingItem = document.createElement('div');
                rankingItem.className = 'ranking-item';
                rankingItem.innerHTML = `
                    <span class="ranking-rank">${index + 1}</span>
                    <span class="ranking-score">${rank.score}点</span>
                    <span class="ranking-date">${formattedDate}</span>
                `;
                rankingList.appendChild(rankingItem);
            });
        }
    };

    // タイマーの更新
    function updateTimer() {
        seconds++;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        timerElement.textContent = `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    }

    // スコアポップアップの表示
    function showScorePopup(points) {
        const popup = document.createElement('div');
        popup.className = 'score-popup';
        popup.textContent = `+${points}`;
        document.body.appendChild(popup);
        
        setTimeout(() => {
            popup.remove();
        }, 1000);
    }

    // スコアの計算
    function calculateScore() {
        const timeBonus = Math.max(0, 300 - seconds); // 5分以内に終わるとボーナス
        const attemptPenalty = attempts * 10;
        const newScore = Math.max(0, 1000 + timeBonus - attemptPenalty);
        const pointsGained = newScore - score;
        score = newScore;
        scoreElement.textContent = score;
        
        if (pointsGained > 0) {
            showScorePopup(pointsGained);
        }
    }

    // ゲームの初期化
    function initializeGame() {
        cards = [...emojis, ...emojis]
            .sort(() => Math.random() - 0.5)
            .map((emoji, index) => ({
                id: index,
                emoji: emoji,
                isFlipped: false,
                isMatched: false
            }));

        gameBoard.innerHTML = '';
        cards.forEach(card => {
            const cardElement = document.createElement('div');
            cardElement.className = 'card';
            cardElement.dataset.id = card.id;
            
            const cardFront = document.createElement('div');
            cardFront.className = 'card-front';
            
            const cardBack = document.createElement('div');
            cardBack.className = 'card-back';
            cardBack.textContent = card.emoji;
            
            cardElement.appendChild(cardFront);
            cardElement.appendChild(cardBack);
            
            cardElement.addEventListener('click', () => flipCard(card.id));
            gameBoard.appendChild(cardElement);
        });

        attempts = 0;
        remainingCards = 16;
        score = 0;
        seconds = 0;
        updateGameInfo();
        gameStatusElement.textContent = 'ゲームを開始してください';
        isGameActive = false;
        
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    }

    // カードを裏返す
    function flipCard(cardId) {
        if (!isGameActive) {
            isGameActive = true;
            gameStatusElement.textContent = 'ゲーム中...';
            timer = setInterval(updateTimer, 1000);
        }

        const card = cards.find(c => c.id === cardId);
        const cardElement = document.querySelector(`[data-id="${cardId}"]`);

        if (flippedCards.length === 2 || card.isFlipped || card.isMatched) return;

        card.isFlipped = true;
        cardElement.classList.add('flipped');
        flippedCards.push(card);

        if (flippedCards.length === 2) {
            attempts++;
            updateGameInfo();
            checkMatch();
        }
    }

    // カードの一致を確認
    function checkMatch() {
        const [card1, card2] = flippedCards;
        
        if (card1.emoji === card2.emoji) {
            card1.isMatched = card2.isMatched = true;
            remainingCards -= 2;
            updateGameInfo();
            
            setTimeout(() => {
                const card1Element = document.querySelector(`[data-id="${card1.id}"]`);
                const card2Element = document.querySelector(`[data-id="${card2.id}"]`);
                
                card1Element.classList.add('matched');
                card2Element.classList.add('matched');
                
                calculateScore();
            }, 500);
            
            if (remainingCards === 0) {
                setTimeout(() => {
                    clearInterval(timer);
                    gameStatusElement.textContent = 'ゲームクリア！';
                    showScorePopup(score);
                    
                    // ランキングにスコアを追加
                    RankingManager.addScore(score, attempts, timerElement.textContent);
                    
                    setTimeout(() => {
                        alert(`おめでとうございます！\n試行回数: ${attempts}回\n経過時間: ${timerElement.textContent}\nスコア: ${score}点`);
                    }, 1000);
                }, 1500);
            }
        } else {
            setTimeout(() => {
                card1.isFlipped = card2.isFlipped = false;
                document.querySelector(`[data-id="${card1.id}"]`).classList.remove('flipped');
                document.querySelector(`[data-id="${card2.id}"]`).classList.remove('flipped');
            }, 1000);
        }

        flippedCards = [];
    }

    // ゲーム情報の更新
    function updateGameInfo() {
        remainingCardsElement.textContent = remainingCards;
        attemptsElement.textContent = attempts;
    }

    // イベントリスナー
    restartButton.addEventListener('click', initializeGame);
    newGameButton.addEventListener('click', () => {
        if (confirm('新しいゲームを開始しますか？')) {
            initializeGame();
        }
    });

    // ランキングタブの切り替え
    rankingTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            rankingTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentRankingTab = tab.dataset.tab;
            RankingManager.updateRankingDisplay();
        });
    });

    // 初期ランキング表示
    RankingManager.updateRankingDisplay();

    // ゲームの開始
    initializeGame();
}); 