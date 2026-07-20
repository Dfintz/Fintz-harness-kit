import { useState, useCallback } from 'react';

export function useLoading(initialState: boolean = false) {
    const [loading, setLoading] = useState(initialState);
    
    const withLoading = useCallback(async <T,>(
        asyncFn: () => Promise<T>
    ): Promise<T> => {
        setLoading(true);
        try {
            return await asyncFn();
        } finally {
            setLoading(false);
        }
    }, []);
    
    return { loading, setLoading, withLoading };
}
