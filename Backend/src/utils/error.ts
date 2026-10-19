/**
* Custom error class that includes an HTTP status code.
* Used to throw errors with a message and corresponding HTTP status.
*/
class AppError extends Error {
    status: number;
    
    /**
    * Creates a new application error.
    * @param message - The error message.
    * @param status - The HTTP status code associated with the error.
    */
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
        (
            Error as ErrorConstructor & {
                captureStackTrace(target: object, constructor?: Function): void; //Added type for Error as ErrorConstructor which can have captureStackTrace method.
            }
        ).captureStackTrace(this, this.constructor);
    }
}

export default AppError;
