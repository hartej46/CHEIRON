class AppError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
        (
            Error as ErrorConstructor & {
                captureStackTrace(target: object, constructor?: Function): void;
            }
        ).captureStackTrace(this, this.constructor);
    }
}

export default AppError;
