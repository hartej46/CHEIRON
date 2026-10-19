class AppError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
        (
            Error as ErrorConstructor & {
                captureStackTrace(target: object, constructor?: Function): void;   //Added type for Error as ErrorConstructor which can have captureStackTrace method.
            }
        ).captureStackTrace(this, this.constructor); 
    }
}

export default AppError;
