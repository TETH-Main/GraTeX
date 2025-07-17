/**
 * GIF生成専用クラス
 * base64形式の画像からGIFを生成する
 */

export class GifGenerator {
    constructor() {
        this.gif = null;
        this.isGenerating = false;
        this.isCancelled = false;
        this.onProgress = null;
        this.onComplete = null;
        this.onError = null;
        this.isLibraryReady = false;
        this.initPromise = null;
        
        // gif.jsライブラリの読み込み確認（非同期）
        this.initPromise = this.initLibrary();
    }
    
    /**
     * gif.jsライブラリの初期化
     */
    async initLibrary() {
        try {
            await this.ensureGifLibrary();
            this.isLibraryReady = true;
            console.log('GifGenerator: gif.js library is ready');
        } catch (error) {
            console.error('GifGenerator initialization failed:', error);
            throw error;
        }
    }
    
    /**
     * GifGeneratorが使用可能かチェック
     * @returns {boolean}
     */
    isReady() {
        return this.isLibraryReady;
    }
    
    /**
     * 初期化を待つ
     * @returns {Promise<void>}
     */
    async waitForReady() {
        if (this.initPromise) {
            await this.initPromise;
        }
        return this.isLibraryReady;
    }

    /**
     * gif.jsライブラリが利用可能かチェック
     */
    ensureGifLibrary() {
        return new Promise((resolve, reject) => {
            if (typeof GIF !== 'undefined' || typeof window.GIF !== 'undefined') {
                resolve();
                return;
            }
            let attempts = 0;
            const maxAttempts = 50;
            const checkInterval = setInterval(() => {
                attempts++;
                if (typeof GIF !== 'undefined' || typeof window.GIF !== 'undefined') {
                    clearInterval(checkInterval);
                    resolve();
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    reject(new Error('gif.jsライブラリが読み込まれていません。'));
                }
            }, 100);
        });
    }

    /**
     * GIF生成を初期化
     * @param {Object} options - GIF生成オプション
     * @param {number} options.width - 幅
     * @param {number} options.height - 高さ
     * @param {number} options.delay - フレーム間隔（ミリ秒）
     * @param {number} options.quality - 品質（1-20、低いほど高品質）
     * @param {boolean} options.repeat - ループ再生
     * @param {number} options.workers - ワーカー数
     */
    initialize(options = {}) {
        if (!this.isLibraryReady) {
            throw new Error('gif.js library is not ready yet. Please wait for initialization.');
        }
        const defaultOptions = {
            width: 640,
            height: 480,
            delay: 100, // 100ms = 10fps
            quality: 10,
            repeat: 0, // 無限ループ
            workers: 2,
            workerScript: './script/gif.worker.js'
        };
        const config = { ...defaultOptions, ...options };
        this.gif = new GIF({
            workers: config.workers,
            quality: config.quality,
            width: config.width,
            height: config.height,
            repeat: config.repeat,
            workerScript: config.workerScript
        });
        this.delay = config.delay;
        this.setupEventListeners();
    }    /**
     * イベントリスナーを設定
     */
    setupEventListeners() {
        if (!this.gif) return;

        this.gif.on('start', () => {
            console.log('GIF生成開始');
        });

        this.gif.on('progress', (progress) => {
            console.log(`GIF生成進捗: ${Math.round(progress * 100)}%`);
            if (this.onProgress) {
                this.onProgress(progress);
            }
        });

        this.gif.on('finished', (blob) => {
            console.log('GIF生成が完了しました');
            this.isGenerating = false;
            if (this.onComplete) {
                this.onComplete(blob);
            }
        });

        this.gif.on('error', (error) => {
            console.error('GIF生成エラー:', error);
            this.isGenerating = false;
            if (this.onError) {
                this.onError(error);
            }
        });

        this.gif.on('abort', () => {
            console.log('GIF生成が中断されました');
            this.isGenerating = false;
        });
    }

    /**
     * base64画像をImageオブジェクトに変換
     * @param {string} base64Data - base64形式の画像データ
     * @returns {Promise<HTMLImageElement>}
     */
    base64ToImage(base64Data) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = base64Data;
        });
    }

    /**
     * 画像をCanvasに描画してピクセルデータを取得
     * @param {HTMLImageElement} image - 画像要素
     * @param {number} width - キャンバス幅
     * @param {number} height - キャンバス高さ
     * @returns {ImageData}
     */
    imageToImageData(image, width, height) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;

        // 画像をキャンバスに描画（リサイズ対応）
        ctx.drawImage(image, 0, 0, width, height);
        
        return ctx.getImageData(0, 0, width, height);
    }

    /**
     * base64画像配列からGIFを生成
     * @param {string[]} base64Images - base64形式の画像配列
     * @param {Object} options - 生成オプション
     * @returns {Promise<Blob>}
     */
    async generateFromBase64Array(base64Images, options = {}) {
        if (this.isGenerating) {
            throw new Error('GIF生成中です');
        }
        if (!base64Images || base64Images.length === 0) {
            throw new Error('画像が指定されていません');
        }
        
        // キャンセル状態をリセット
        this.resetCancelState();
        this.isGenerating = true;
        
        try {
            if (!this.isLibraryReady) {
                await this.initPromise;
            }
            
            // キャンセルチェック
            if (this.isCancelled) {
                throw new Error('GIF generation was cancelled');
            }
            
            const firstImage = await this.base64ToImage(base64Images[0]);
            const width = options.width || firstImage.width;
            const height = options.height || firstImage.height;
            const quality = options.quality || this.getOptimalQuality(base64Images.length);
            this.initialize({
                width,
                height,
                delay: options.delay || 100,
                quality,
                repeat: options.repeat !== undefined ? options.repeat : 0,
                workers: options.workers || 2
            });
            
            for (let i = 0; i < base64Images.length; i++) {
                // キャンセルチェック
                if (this.isCancelled) {
                    throw new Error('GIF generation was cancelled');
                }
                
                const image = await this.base64ToImage(base64Images[i]);
                const imageData = this.imageToImageData(image, width, height);
                this.gif.addFrame(imageData, { delay: this.delay, copy: true });
            }
            
            // キャンセルチェック
            if (this.isCancelled) {
                throw new Error('GIF generation was cancelled');
            }
            
            return new Promise((resolve, reject) => {
                this.onComplete = resolve;
                this.onError = reject;
                this.gif.render();
            });
        } catch (error) {
            this.isGenerating = false;
            throw error;
        }
    }

    /**
     * Blobをダウンロード用URLに変換
     * @param {Blob} blob - GIFブロブ
     * @returns {string} ダウンロード用URL
     */
    createDownloadUrl(blob) {
        return URL.createObjectURL(blob);
    }

    /**
     * GIFをダウンロード
     * @param {Blob} blob - GIFブロブ
     * @param {string} filename - ファイル名
     */
    downloadGif(blob, filename = 'animation.gif') {
        const url = this.createDownloadUrl(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * 生成をキャンセル
     */
    cancel() {
        console.log('GifGenerator: キャンセル要求を受信');
        this.isCancelled = true;
        if (this.gif && this.isGenerating) {
            this.gif.abort();
            this.isGenerating = false;
        }
    }

    /**
     * キャンセル状態をリセット
     */
    resetCancelState() {
        this.isCancelled = false;
    }

    /**
     * 進捗コールバックを設定
     * @param {Function} callback - 進捗コールバック (0-1の値)
     */
    setProgressCallback(callback) {
        this.onProgress = callback;
    }

    /**
     * 完了コールバックを設定
     * @param {Function} callback - 完了コールバック
     */
    setCompleteCallback(callback) {
        this.onComplete = callback;
    }

    /**
     * エラーコールバックを設定
     * @param {Function} callback - エラーコールバック
     */
    setErrorCallback(callback) {
        this.onError = callback;
    }

    /**
     * 現在の生成状態を取得
     * @returns {boolean}
     */
    getGeneratingStatus() {
        return this.isGenerating;
    }

    /**
     * GIF品質を調整（フレーム数に応じて自動調整）
     * @param {number} frameCount - フレーム数
     * @returns {number} 推奨品質値
     */
    getOptimalQuality(frameCount) {
        if (frameCount <= 10) return 5;  // 高品質
        if (frameCount <= 30) return 10; // 標準品質
        if (frameCount <= 60) return 15; // 低品質
        return 20; // 最低品質（大量フレーム用）
    }

    /**
     * フレームレートからdelayを計算
     * @param {number} fps - フレームレート
     * @returns {number} ミリ秒単位のdelay
     */
    static fpsToDelay(fps) {
        return Math.round(1000 / Math.max(1, Math.min(60, fps)));
    }

    /**
     * リソースをクリーンアップ
     */
    dispose() {
        if (this.gif) {
            this.gif.abort();
            this.gif = null;
        }
        this.isGenerating = false;
        this.onProgress = null;
        this.onComplete = null;
        this.onError = null;
    }
}
