import { redirect } from 'next/navigation';
import DashboardPage from '../dashboard/page';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

it('redirects old dashboard links to the vehicle list', () => {
  DashboardPage();

  expect(redirect).toHaveBeenCalledWith('/car');
});
