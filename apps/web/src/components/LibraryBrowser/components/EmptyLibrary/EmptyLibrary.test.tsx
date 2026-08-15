import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyLibrary } from './EmptyLibrary';

describe('EmptyLibrary', () => {
  it('does not tell somebody who mistyped a title to scan anything', () => {
    render(<EmptyLibrary search="hetat" libraryName="Films" hasContentElsewhere />);

    expect(screen.getByText(/Nothing matches “hetat”/)).toBeInTheDocument();
    expect(screen.queryByText(/[Ss]can/)).not.toBeInTheDocument();
  });

  it('names the library that is empty rather than the server', () => {
    render(<EmptyLibrary search="" libraryName="Documentaries" hasContentElsewhere />);

    expect(screen.getByText('Nothing in Documentaries yet')).toBeInTheDocument();
  });

  it('says the rest of the server is fine when only this library is empty', () => {
    render(<EmptyLibrary search="" libraryName="Documentaries" hasContentElsewhere />);

    expect(screen.getByText(/Your other libraries have media in them/)).toBeInTheDocument();
  });

  it('treats a server with nothing anywhere as one that has not been set up', () => {
    render(<EmptyLibrary search="" libraryName="Films" hasContentElsewhere={false} />);

    expect(screen.getByText('Nothing has been scanned yet')).toBeInTheDocument();
    expect(screen.getByText(/Add a library pointing at a folder/)).toBeInTheDocument();
  });

  it('copes with no library having been chosen yet', () => {
    render(<EmptyLibrary search="" libraryName={null} hasContentElsewhere />);

    expect(screen.getByText('Nothing in this library yet')).toBeInTheDocument();
  });

  it('does not read as an error, because an empty shelf is not one', () => {
    render(<EmptyLibrary search="" libraryName="Films" hasContentElsewhere={false} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(EmptyLibrary.displayName).toBe('EmptyLibrary');
  });
});
