import { NextRequest, NextResponse } from "next/server";
import { apiClient, isAxiosError, apiConfig } from "@/utils/serverApiClient";
import { ApiRoutes } from "@/lib/helpers/constants/local.constant";
import { GLOBAL_ERRORS } from "@/lib/helpers/constants/global.constants";

export async function GET(request: NextRequest) {
    
    try {
        const params = request.nextUrl.searchParams;
        
        const response = await apiClient.get(ApiRoutes.STOCK_INFORMATION.DOWNLOAD_EXCEL,
            apiConfig(request, { params, responseType: 'arraybuffer' })
        );

        if (response.status !== 200) {
            return NextResponse.json("Failed to get stock information", { status: response.status });
        }
        const headers = new Headers();
        headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        headers.set("Content-Disposition", "attachment; filename=stockInformation.xlsx");
        return new NextResponse(response.data, {
            status: 200,
            headers,
        });
    } catch (error) {
        if (isAxiosError(error)) {
            return NextResponse.json(
                error.response?.data || "Unknown error",
                { status: error.response?.status || 500 }
            );
        }
        return NextResponse.json(GLOBAL_ERRORS.INTERNAL_SERVER_ERROR, { status: 500 });
    }
}