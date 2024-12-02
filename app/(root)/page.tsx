import { redirect } from 'next/navigation';

import RightSidebar from '@/components/RightSidebar';
import TotalBalanceBox from '@/components/TotalBalanceBox';
import HeaderBox from '@/components/ui/HeaderBox';
import { getLoggedInUser } from '@/lib/actions/user.actions';

const Home = async () => {
  // const loggedIn = {
  //   firstName: 'Ian',
  //   lastName: 'Wanjira',
  //   email: 'ianwanjira4@gmail.com',
  // };
  const loggedIn: User = await getLoggedInUser();
  if (!loggedIn) redirect('/sign-in');

  return (
    <section className="home">
      <div className="home-content">
        <header className="home-header">
          <HeaderBox
            type="greeting"
            title="Welcome"
            user={loggedIn?.firstName || 'Guest'}
            subtext="Access and manage your account and transactions efficiently."
          />

          <TotalBalanceBox
            accounts={[]}
            totalBanks={3}
            totalCurrentBalance={91250.35}
          />
        </header>
        RECENT TRANSACTIONS
      </div>

      <RightSidebar
        user={loggedIn}
        transactions={[]}
        banks={[{ currentBalance: 75000 }, { currentBalance: 20000 }]}
      />
    </section>
  );
};

export default Home;
