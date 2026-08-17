import { AdminArea } from '@FluxWeb/components/AdminArea/AdminArea';
import { usePlace } from '@FluxWeb/navigation/usePlace';

/**
 * The server itself: what it is doing, what is on it, and who may do what.
 */
const AdminPage = () => {
  const { place, replace } = usePlace();

  return (
    <AdminArea
      initialPanel={place.adminPanel}
      onPanelChange={(panel) => {
        replace({ adminPanel: panel });
      }}
      initialJob={place.adminJob}
      onJobChange={(kind) => {
        replace({ adminJob: kind });
      }}
    />
  );
};

AdminPage.displayName = 'AdminPage';

export { AdminPage };
