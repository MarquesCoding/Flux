import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConnectToServer } from './ConnectToServer';

const shown = (reach: (address: string) => Promise<boolean>) => {
  const onConnected = vi.fn();
  const actor = userEvent.setup();

  render(<ConnectToServer onConnected={onConnected} reach={reach} />);

  return {
    actor,
    onConnected,
    field: () => screen.getByLabelText(/server address/i),
    connect: () => screen.getByRole('button', { name: /connect/i }),
  };
};

const answering = () => vi.fn(() => Promise.resolve(true));

describe('ConnectToServer', () => {
  it('keeps the address once something answered at it', async () => {
    const world = shown(answering());

    await world.actor.type(world.field(), 'flux.example.com');
    await world.actor.click(world.connect());

    await waitFor(() => {
      expect(world.onConnected).toHaveBeenCalledWith('https://flux.example.com');
    });
  });

  it('asks the address it worked out rather than what was typed', async () => {
    const reach = answering();
    const world = shown(reach);

    await world.actor.type(world.field(), '  flux.example.com/  ');
    await world.actor.click(world.connect());

    await waitFor(() => {
      expect(reach).toHaveBeenCalledWith('https://flux.example.com');
    });
  });

  it('keeps nothing where nothing answered, and says where it looked', async () => {
    const world = shown(vi.fn(() => Promise.resolve(false)));

    await world.actor.type(world.field(), 'flux.example.com');
    await world.actor.click(world.connect());

    expect(
      await screen.findByText(/nothing answered at https:\/\/flux\.example\.com/i),
    ).toBeInTheDocument();
    expect(world.onConnected).not.toHaveBeenCalled();
  });

  it('says what is wrong with an address rather than asking the network about it', async () => {
    const reach = answering();
    const world = shown(reach);

    await world.actor.type(world.field(), 'not a server');
    await world.actor.click(world.connect());

    expect(await screen.findByText(/does not look like a web address/i)).toBeInTheDocument();
    expect(reach).not.toHaveBeenCalled();
  });

  it('asks for something rather than reaching for an empty address', async () => {
    const reach = answering();
    const world = shown(reach);

    await world.actor.click(world.connect());

    expect(await screen.findByText(/enter the address/i)).toBeInTheDocument();
    expect(reach).not.toHaveBeenCalled();
  });

  it('says it is looking, since a server that is not there takes a while to say so', async () => {
    let answer: (found: boolean) => void = () => undefined;
    const world = shown(
      () =>
        new Promise<boolean>((resolve) => {
          answer = resolve;
        }),
    );

    await world.actor.type(world.field(), 'flux.example.com');
    await world.actor.click(world.connect());

    expect(await screen.findByText(/looking for it/i)).toBeInTheDocument();

    answer(true);

    await waitFor(() => {
      expect(world.onConnected).toHaveBeenCalled();
    });
  });
});

describe('coming back because the server stopped answering', () => {
  it('says which server, rather than showing an empty box and no reason', () => {
    render(
      <ConnectToServer
        onConnected={vi.fn()}
        startWith="https://flux.example.com"
        couldNotReach="https://flux.example.com"
      />,
    );

    expect(
      screen.getByText(/Flux at https:\/\/flux\.example\.com could not be reached/),
    ).toBeInTheDocument();
  });

  it('puts the address back in the box, since nobody remembers what they typed months ago', () => {
    render(
      <ConnectToServer
        onConnected={vi.fn()}
        startWith="https://flux.example.com"
        couldNotReach="https://flux.example.com"
      />,
    );

    expect(screen.getByLabelText('Server address')).toHaveValue('https://flux.example.com');
  });

  it('says nothing of the sort on a first launch', () => {
    render(<ConnectToServer onConnected={vi.fn()} />);

    expect(screen.getByLabelText('Server address')).toHaveValue('');
    expect(screen.queryByText(/could not be reached/)).toBeNull();
  });
});
