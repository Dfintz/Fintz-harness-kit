import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { NotFound } from '@/pages/NotFound';

const renderWithRouter = (ui: React.ReactElement) => {
    return render(
        <BrowserRouter>{ui}</BrowserRouter>
    );
};

describe('NotFound Page', () => {
    it('renders 404 heading', () => {
        renderWithRouter(<NotFound />);
        
        expect(screen.getByText('404')).toBeInTheDocument();
    });

    it('renders subtitle message', () => {
        renderWithRouter(<NotFound />);
        
        expect(screen.getByText('Lost in the Verse')).toBeInTheDocument();
    });

    it('renders heading as h1', () => {
        renderWithRouter(<NotFound />);
        
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('404');
    });

    it('renders navigation buttons', () => {
        renderWithRouter(<NotFound />);
        
        expect(screen.getByRole('button', { name: /navigate to dashboard/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /go back to previous page/i })).toBeInTheDocument();
    });

    it('renders popular destination links', () => {
        renderWithRouter(<NotFound />);
        
        expect(screen.getByRole('link', { name: /fleet management/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /tactical calendar/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /logistics/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /trading/i })).toBeInTheDocument();
    });

    it('renders description message about lost coordinates', () => {
        renderWithRouter(<NotFound />);
        
        expect(screen.getByText(/coordinates.*don't match any known location/i)).toBeInTheDocument();
    });
});
