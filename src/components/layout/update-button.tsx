import { Button } from "@mui/material";
import { useState } from "react";

import { useUpdate } from "@/hooks/use-update";

import { UpdateDialog } from "../setting/mods/update-dialog";

interface Props {
  className?: string;
}

export const UpdateButton = (props: Props) => {
  const { className } = props;
  const [open, setOpen] = useState(false);

  const { updateInfo } = useUpdate();

  if (!updateInfo?.available) return null;

  return (
    <>
      <UpdateDialog
        open={open}
        data={updateInfo as any}
        onClose={() => setOpen(false)}
      />

      <Button
        color="error"
        variant="contained"
        size="small"
        className={className}
        onClick={() => setOpen(true)}
      >
        New
      </Button>
    </>
  );
};
