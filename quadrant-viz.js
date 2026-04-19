// ======================== quadrant-viz-optimized.js ========================
// 超学人格测试 · SVG 极坐标网格（悬停延迟 + RAF 节流 + 移动端优化）
// 修复：移动端点击后 tooltip 自动隐藏

(function(){
    "use strict";

    if (typeof TYPES === 'undefined') {
        console.warn('quadrant-viz: 缺少必要数据 (TYPES)');
        return;
    }

    const TYPE_COLORS = {
        "红红火火": "#FF8C42", "翩翩起舞": "#E56B9D", "酷酷": "#3D9B9B",
        "害羞": "#F4A3A3", "鄙视": "#8B6B9E", "猪猪": "#F9C06A", "紫色": "#B185DB"
    };

    function computeUserCoordinate() {
        if (typeof answers === 'undefined' || !Array.isArray(answers)) return null;
        for (let a of answers) if (!a) return null;
        if (window.computeCoordinateFromAnswers) {
            return window.computeCoordinateFromAnswers(answers);
        }
        let sumX = -1, sumY = -3;
        answers.forEach(a => { sumX += a.dx; sumY += a.dy; });
        return { x: sumX, y: sumY };
    }

    function getPolarType(x, y) {
        if (window.getTypeFromCoord) return window.getTypeFromCoord(x, y);
        const dist = Math.hypot(x, y);
        if (dist <= 3.0) return "猪猪";
        let angleDeg = Math.atan2(y, x) * 180 / Math.PI;
        if (angleDeg < 0) angleDeg += 360;
        let rotated = (angleDeg + 30) % 360;
        if (rotated < 60) return "翩翩起舞";
        else if (rotated < 120) return "红红火火";
        else if (rotated < 180) return "紫色";
        else if (rotated < 240) return "害羞";
        else if (rotated < 300) return "鄙视";
        else return "酷酷";
    }

    class SVGQuadrantGrid {
        constructor(container) {
            this.container = container;
            this.userCoord = { x: 0, y: 0 };
            this.cellSize = 40;
            this.gridMin = -20;
            this.gridMax = 20;
            this.size = this.gridMax - this.gridMin + 1;
            this.viewX = 0;
            this.viewY = 0;
            this.scale = 1.0;
            this.dragging = false;
            this.lastPointer = { x: 0, y: 0 };
            this.cells = [];
            this.hoverTimer = null;      // 悬停延迟定时器
            this.autoHideTimer = null;   // 自动隐藏定时器
            this.rafId = null;
            this.createSVG();
            this.bindEvents();
        }

        createSVG() {
            const svgNS = "http://www.w3.org/2000/svg";
            this.svg = document.createElementNS(svgNS, "svg");
            this.svg.setAttribute("width", "100%");
            this.svg.setAttribute("height", "100%");
            this.svg.style.display = "block";
            this.svg.style.background = "transparent";
            this.svg.style.cursor = "grab";
            this.svg.style.touchAction = "none";

            const defs = document.createElementNS(svgNS, "defs");
            const filter = document.createElementNS(svgNS, "filter");
            filter.setAttribute("id", "sunGlow");
            filter.setAttribute("x", "-50%");
            filter.setAttribute("y", "-50%");
            filter.setAttribute("width", "200%");
            filter.setAttribute("height", "200%");
            filter.innerHTML = `
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            `;
            defs.appendChild(filter);
            this.svg.appendChild(defs);

            this.gridGroup = document.createElementNS(svgNS, "g");
            this.svg.appendChild(this.gridGroup);
            this.highlightGroup = document.createElementNS(svgNS, "g");
            this.svg.appendChild(this.highlightGroup);
            this.container.appendChild(this.svg);
            this.renderGrid();
        }

        renderGrid() {
            const { cellSize, gridMin, gridMax, gridGroup, size } = this;
            const svgNS = "http://www.w3.org/2000/svg";
            gridGroup.innerHTML = "";
            this.cells = [];

            for (let row = 0; row < size; row++) {
                for (let col = 0; col < size; col++) {
                    const gx = gridMin + col;
                    const gy = gridMax - row;
                    const type = getPolarType(gx, gy);
                    const color = TYPE_COLORS[type] || "#ccc";

                    const rect = document.createElementNS(svgNS, "rect");
                    rect.setAttribute("x", col * cellSize);
                    rect.setAttribute("y", row * cellSize);
                    rect.setAttribute("width", cellSize);
                    rect.setAttribute("height", cellSize);
                    rect.setAttribute("fill", color);
                    rect.setAttribute("stroke", "#ffffff");
                    rect.setAttribute("stroke-width", "0.8");
                    rect.setAttribute("opacity", "0.85");
                    rect.dataset.index = row * size + col;
                    gridGroup.appendChild(rect);
                    this.cells.push({ gx, gy, type });
                }
            }
            this.drawAxisLabels();
            this.updateViewImmediate();
        }

        drawAxisLabels() {
            const { cellSize, gridMin, gridMax, gridGroup, size } = this;
            const svgNS = "http://www.w3.org/2000/svg";
            const labelGroup = document.createElementNS(svgNS, "g");
            labelGroup.setAttribute("class", "axis-labels");
            labelGroup.style.fontFamily = "system-ui, sans-serif";
            labelGroup.style.fontSize = "12px";
            labelGroup.style.fill = "#4b3b6e";
            labelGroup.style.fontWeight = "500";
            labelGroup.style.pointerEvents = "none";

            for (let col = 0; col < size; col++) {
                const x = gridMin + col;
                if (x % 5 === 0 || x === 0) {
                    const text = document.createElementNS(svgNS, "text");
                    text.setAttribute("x", col * cellSize + cellSize/2);
                    text.setAttribute("y", size * cellSize + 18);
                    text.setAttribute("text-anchor", "middle");
                    text.textContent = x;
                    labelGroup.appendChild(text);
                }
            }
            for (let row = 0; row < size; row++) {
                const y = gridMax - row;
                if (y % 5 === 0 || y === 0) {
                    const text = document.createElementNS(svgNS, "text");
                    text.setAttribute("x", -8);
                    text.setAttribute("y", row * cellSize + cellSize/2 + 4);
                    text.setAttribute("text-anchor", "end");
                    text.textContent = y;
                    labelGroup.appendChild(text);
                }
            }

            const xName = document.createElementNS(svgNS, "text");
            xName.setAttribute("x", (size * cellSize) / 2);
            xName.setAttribute("y", size * cellSize + 38);
            xName.setAttribute("text-anchor", "middle");
            xName.style.fontWeight = "bold";
            xName.style.fill = "#2d2440";
            xName.textContent = "能量 X";
            labelGroup.appendChild(xName);

            const yName = document.createElementNS(svgNS, "text");
            yName.setAttribute("x", -30);
            yName.setAttribute("y", (size * cellSize) / 2);
            yName.setAttribute("text-anchor", "middle");
            yName.setAttribute("transform", `rotate(-90, -30, ${(size * cellSize) / 2})`);
            yName.style.fontWeight = "bold";
            yName.style.fill = "#2d2440";
            yName.textContent = "情感 Y";
            labelGroup.appendChild(yName);
            gridGroup.appendChild(labelGroup);
        }

        getPointerCoords(e) {
            let clientX, clientY;
            if (e.clientX !== undefined) {
                clientX = e.clientX;
                clientY = e.clientY;
            } else if (e.touches && e.touches.length > 0) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else if (e.changedTouches && e.changedTouches.length > 0) {
                clientX = e.changedTouches[0].clientX;
                clientY = e.changedTouches[0].clientY;
            } else {
                clientX = 0;
                clientY = 0;
            }
            return { clientX, clientY };
        }

        getCellFromMouse(clientX, clientY) {
            const rect = this.svg.getBoundingClientRect();
            const svgX = (clientX - rect.left) / rect.width * this.size * this.cellSize / this.scale + this.viewX;
            const svgY = (clientY - rect.top) / rect.height * this.size * this.cellSize / this.scale + this.viewY;
            const col = Math.floor(svgX / this.cellSize);
            const row = Math.floor(svgY / this.cellSize);
            if (row >= 0 && row < this.size && col >= 0 && col < this.size) {
                return this.cells[row * this.size + col];
            }
            return null;
        }

        showTooltipForCell(cell, clientX, clientY) {
            if (!cell) {
                this.hideTooltip();
                return;
            }
            // 清除之前的自动隐藏定时器
            if (this.autoHideTimer) {
                clearTimeout(this.autoHideTimer);
                this.autoHideTimer = null;
            }

            const tooltip = this.getTooltipElement();
            const typeName = TYPES[cell.type]?.title || cell.type;
            tooltip.innerHTML = `坐标 (${cell.gx}, ${cell.gy})<br/>${typeName}`;
            tooltip.style.display = "block";

            const padding = 15;
            const tooltipRect = tooltip.getBoundingClientRect();
            let left = clientX + padding;
            let top = clientY - 30;
            if (left + tooltipRect.width > window.innerWidth) {
                left = clientX - tooltipRect.width - padding;
            }
            if (top < 0) top = clientY + 30;
            tooltip.style.left = left + "px";
            tooltip.style.top = top + "px";

            // 设置 3 秒后自动隐藏
            this.autoHideTimer = setTimeout(() => {
                this.hideTooltip();
                this.autoHideTimer = null;
            }, 3000);
        }

        hideTooltip() {
            const tooltip = this.getTooltipElement();
            tooltip.style.display = "none";
            if (this.autoHideTimer) {
                clearTimeout(this.autoHideTimer);
                this.autoHideTimer = null;
            }
        }

        getTooltipElement() {
            if (!this._tooltip) {
                this._tooltip = document.createElement("div");
                this._tooltip.style.position = "fixed";
                this._tooltip.style.background = "rgba(30,27,46,0.9)";
                this._tooltip.style.color = "#f0e6ff";
                this._tooltip.style.padding = "6px 12px";
                this._tooltip.style.borderRadius = "12px";
                this._tooltip.style.fontSize = "13px";
                this._tooltip.style.pointerEvents = "none";
                this._tooltip.style.zIndex = "10000";
                this._tooltip.style.border = "1px solid #B185DB";
                this._tooltip.style.backdropFilter = "blur(4px)";
                this._tooltip.style.display = "none";
                this._tooltip.style.maxWidth = "200px";
                this._tooltip.style.wordBreak = "break-word";
                this._tooltip.style.textAlign = "center";
                document.body.appendChild(this._tooltip);
            }
            return this._tooltip;
        }

        drawSun(x, y) {
            const { highlightGroup, cellSize, gridMin, gridMax } = this;
            highlightGroup.innerHTML = "";
            const col = x - gridMin;
            const row = gridMax - y;
            const cx = col * cellSize + cellSize/2;
            const cy = row * cellSize + cellSize/2;
            const svgNS = "http://www.w3.org/2000/svg";
            const circle = document.createElementNS(svgNS, "circle");
            circle.setAttribute("cx", cx);
            circle.setAttribute("cy", cy);
            circle.setAttribute("r", cellSize * 0.35);
            circle.setAttribute("fill", "#FFD966");
            circle.setAttribute("filter", "url(#sunGlow)");
            circle.setAttribute("stroke", "#FFB347");
            circle.setAttribute("stroke-width", "2");
            circle.setAttribute("pointer-events", "none");
            highlightGroup.appendChild(circle);
        }

        updateViewImmediate() {
            const { svg, cellSize, size, viewX, viewY, scale } = this;
            const totalSize = size * cellSize;
            svg.setAttribute("viewBox", `${viewX} ${viewY} ${totalSize / scale} ${totalSize / scale}`);
            const user = computeUserCoordinate();
            if (user) {
                this.userCoord = user;
                this.drawSun(user.x, user.y);
            }
        }

        updateViewThrottled() {
            if (this.rafId) return;
            this.rafId = requestAnimationFrame(() => {
                this.updateViewImmediate();
                this.rafId = null;
            });
        }

        clearHoverTimer() {
            if (this.hoverTimer) {
                clearTimeout(this.hoverTimer);
                this.hoverTimer = null;
            }
        }

        scheduleTooltip(clientX, clientY) {
            this.clearHoverTimer();
            // 不清除 autoHideTimer，因为即将显示新 tooltip 时会重置
            this.hoverTimer = setTimeout(() => {
                const cell = this.getCellFromMouse(clientX, clientY);
                this.showTooltipForCell(cell, clientX, clientY);
                this.hoverTimer = null;
            }, 150);
        }

        bindEvents() {
            const svg = this.svg;

            const handlePointerMove = (e) => {
                e.preventDefault();
                const { clientX, clientY } = this.getPointerCoords(e);

                if (this.dragging) {
                    this.hideTooltip();
                    this.clearHoverTimer();

                    const rect = svg.getBoundingClientRect();
                    const dx = clientX - this.lastPointer.x;
                    const dy = clientY - this.lastPointer.y;
                    const scaleFactor = (this.size * this.cellSize) / (rect.width * this.scale);
                    this.viewX -= dx * scaleFactor;
                    this.viewY -= dy * scaleFactor;
                    this.lastPointer = { x: clientX, y: clientY };
                    this.updateViewThrottled();
                } else {
                    this.scheduleTooltip(clientX, clientY);
                }
            };

            const handlePointerDown = (e) => {
                e.preventDefault();
                this.dragging = true;
                const { clientX, clientY } = this.getPointerCoords(e);
                this.lastPointer = { x: clientX, y: clientY };
                svg.style.cursor = "grabbing";
                this.hideTooltip();
                this.clearHoverTimer();
            };

            const handlePointerUp = (e) => {
                e.preventDefault();
                this.dragging = false;
                svg.style.cursor = "grab";
                this.clearHoverTimer();
                const { clientX, clientY } = this.getPointerCoords(e);
                this.scheduleTooltip(clientX, clientY);
            };

            const handlePointerLeave = () => {
                this.dragging = false;
                svg.style.cursor = "grab";
                this.hideTooltip();
                this.clearHoverTimer();
            };

            const handleWheel = (e) => {
                e.preventDefault();
                const rect = svg.getBoundingClientRect();
                const { clientX, clientY } = this.getPointerCoords(e);
                const svgX = (clientX - rect.left) / rect.width * this.size * this.cellSize / this.scale + this.viewX;
                const svgY = (clientY - rect.top) / rect.height * this.size * this.cellSize / this.scale + this.viewY;

                const delta = -Math.sign(e.deltaY) * 0.1;
                const newScale = Math.min(3.0, Math.max(0.5, this.scale + delta));
                this.scale = newScale;
                const newW = this.size * this.cellSize / this.scale;
                const newH = this.size * this.cellSize / this.scale;
                this.viewX = svgX - (clientX - rect.left) / rect.width * newW;
                this.viewY = svgY - (clientY - rect.top) / rect.height * newH;
                this.updateViewImmediate();

                this.clearHoverTimer();
                this.scheduleTooltip(clientX, clientY);
            };

            svg.addEventListener("mousedown", handlePointerDown);
            svg.addEventListener("mousemove", handlePointerMove);
            svg.addEventListener("mouseup", handlePointerUp);
            svg.addEventListener("mouseleave", handlePointerLeave);
            svg.addEventListener("wheel", handleWheel, { passive: false });

            svg.addEventListener("touchstart", handlePointerDown, { passive: false });
            svg.addEventListener("touchmove", handlePointerMove, { passive: false });
            svg.addEventListener("touchend", handlePointerUp);
            svg.addEventListener("touchcancel", handlePointerUp);
        }

        setUserCoord(x, y) {
            this.userCoord = { x, y };
            const { cellSize, size, gridMin, gridMax } = this;
            const col = x - gridMin;
            const row = gridMax - y;
            const totalSize = size * cellSize;
            const defaultScale = 1.5;
            this.scale = defaultScale;
            const vbW = totalSize / this.scale;
            const vbH = totalSize / this.scale;
            this.viewX = col * cellSize + cellSize/2 - vbW/2;
            this.viewY = row * cellSize + cellSize/2 - vbH/2;
            this.updateViewImmediate();
        }
    }

    // ---------- 界面注入 ----------
    let gridInstance = null;

    function injectSVG() {
        const resultPanel = document.querySelector('#resultScreen .result-panel');
        if (!resultPanel) return;
        const oldWrapper = document.querySelector('.svg-quadrant-wrapper');
        if (oldWrapper) oldWrapper.remove();

        const userCoord = computeUserCoordinate();
        if (!userCoord) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'svg-quadrant-wrapper';
        wrapper.style.marginTop = '16px';
        wrapper.style.background = 'rgba(255,248,240,0.4)';
        wrapper.style.backdropFilter = 'blur(8px)';
        wrapper.style.borderRadius = '28px';
        wrapper.style.padding = '16px 12px 12px';
        wrapper.style.border = '1px solid rgba(245,160,60,0.3)';

        const coordDisplay = document.createElement('div');
        coordDisplay.style.textAlign = 'center';
        coordDisplay.style.marginBottom = '8px';
        coordDisplay.style.fontSize = '1rem';
        coordDisplay.style.fontWeight = '600';
        coordDisplay.style.color = '#2d2440';
        coordDisplay.style.background = '#ede9fe';
        coordDisplay.style.padding = '4px 16px';
        coordDisplay.style.borderRadius = '40px';
        coordDisplay.style.display = 'inline-block';
        coordDisplay.style.marginLeft = 'auto';
        coordDisplay.style.marginRight = 'auto';
        coordDisplay.style.width = 'fit-content';
        coordDisplay.textContent = `你的位置 (${userCoord.x}, ${userCoord.y})`;
        wrapper.appendChild(coordDisplay);

        const svgContainer = document.createElement('div');
        svgContainer.style.width = '100%';
        svgContainer.style.aspectRatio = '1 / 1';
        svgContainer.style.maxHeight = '600px';
        svgContainer.style.borderRadius = '20px';
        svgContainer.style.overflow = 'hidden';
        wrapper.appendChild(svgContainer);

        const restartBtn = document.getElementById('restartBtn');
        resultPanel.insertBefore(wrapper, restartBtn);

        gridInstance = new SVGQuadrantGrid(svgContainer);
        gridInstance.setUserCoord(userCoord.x, userCoord.y);
    }

    function patchShowResult() {
        if (typeof showResult !== 'function') return;
        const original = showResult;
        window.showResult = function() {
            original.apply(this, arguments);
            setTimeout(injectSVG, 50);
        };
    }

    function patchRestart() {
        const btn = document.getElementById('restartBtn');
        if (btn) {
            btn.addEventListener('click', () => {
                const wrapper = document.querySelector('.svg-quadrant-wrapper');
                if (wrapper) wrapper.remove();
                gridInstance = null;
            });
        }
    }

    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                patchShowResult();
                patchRestart();
            });
        } else {
            patchShowResult();
            patchRestart();
        }
    }

    init();
})();
