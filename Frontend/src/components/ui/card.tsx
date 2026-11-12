import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = "", ...props }: CardProps) {
    return <div className={`ui-card ${className}`.trim()} {...props} />;
}

export function CardContent({ className = "", ...props }: CardProps) {
    return <div className={`ui-card-content ${className}`.trim()} {...props} />;
}
