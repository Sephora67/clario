import { cn } from "@/lib/utils";
import teacherThumbs from "@/assets/teacher-thumbs.png.asset.json";
import teacherWelcome from "@/assets/teacher-welcome.png.asset.json";

export function TeacherHost({ pose, text, gone }: { pose: "wave" | "thumbs"; text: string; gone: boolean }) {
  return (
    <div className={cn("wb-host-slot absolute -translate-x-1/2 -translate-y-1/2", gone && "wb-host-gone")}>
      <div className="wb-host text-center">
        <img
          src={pose === "wave" ? teacherWelcome.url : teacherThumbs.url}
          alt={pose === "wave" ? "Professeure Clario souhaitant la bienvenue" : "Professeure Clario félicitant avec un pouce levé"}
          className={cn("wb-host-image mx-auto h-auto w-full object-contain", pose === "wave" ? "wb-host-welcome" : "wb-host-thumbs")}
        />
        {text && (
          <p className="wb-write mt-[0.15cqw] font-hand text-[2.6cqw] font-bold leading-tight" style={{ animationDelay: "0.55s" }}>
            {text}
          </p>
        )}
      </div>
    </div>
  );
}
