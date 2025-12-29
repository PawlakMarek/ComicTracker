import { toast } from "react-hot-toast";

export const useToaster = () => {
  const showToast = (message: string, type: "success" | "error" | "default" = "default") => {
    switch (type) {
      case "success":
        toast.success(message);
        break;
      case "error":
        toast.error(message);
        break;
      default:
        toast(message);
        break;
    }
  };

  return { showToast };
};
