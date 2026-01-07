import Sort from "@/components/Sort";
import Card from "@/components/Card";
import { getFiles } from "@/lib/actions/file.actions";
import { getFileTypesParams } from "@/lib/utils";
import { FileType, FileDocument } from "@/types";

interface PageProps {
  params?: { type?: string };
  searchParams?: { query?: string; sort?: string };
}

const Page = async ({ params, searchParams }: PageProps) => {
  const type = params?.type ?? "";
  const searchText = searchParams?.query ?? "";
  const sort = searchParams?.sort ?? "";

  const types = getFileTypesParams(type) as FileType[];
  const files = await getFiles({ types, searchText, sort });

  return (
    <div className="page-container">
      <section className="w-full">
        <h1 className="h1 capitalize">{type}</h1>

        <div className="total-size-section">
          <p className="body-1">
            Total: <span className="h5">0 MB</span>
          </p>

          <div className="sort-container">
            <p className="body-1 hidden text-light-200 sm:block">Sort by:</p>
            <Sort />
          </div>
        </div>
      </section>

      {files?.total > 0 ? (
        <section className="file-list">
          {files.documents.map((file: FileDocument) => (
            <Card key={file.$id} file={file} />
          ))}
        </section>
      ) : (
        <p className="empty-list">No files uploaded</p>
      )}
    </div>
  );
};

export default Page;
