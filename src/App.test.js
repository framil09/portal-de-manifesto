import { render, screen } from "@testing-library/react";
import App from "./App";

test("renderiza o titulo principal da plataforma", () => {
  render(<App />);
  expect(screen.getByText(/Manifestação de Interesse Municipal/i)).toBeTruthy();
});
