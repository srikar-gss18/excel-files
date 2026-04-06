"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import dayjs from "dayjs";
import axios from "axios";
import customParseFormat from "dayjs/plugin/customParseFormat";
import advancedFormat from "dayjs/plugin/advancedFormat";
import Loader from "@/components/core/Loader/Loader";
import EditStockInfoPopup from "@/components/core/Popups/EditPopup/EditPopup";
import DataTablePagination from "@/components/core/Pagination/Pagination";
import Status from "@/components/core/Status/Status";
import PriorityBadge from "@/components/common/PriorityBadge/PriorityBadge";
import PageHeader from "@/components/common/PageHeader/PageHeader";
import SummaryCard from "@/components/core/SummaryCard/SummaryCard";
import DynamicTable, { TableColumn } from "@/components/core/DynamicTable/DynamicTable";
import StockPlanningPopup from "@/components/core/Popups/StockPlanningPopup/StockPlanningPopup";
import { RootState } from "@/lib/stores/store";
import { showSnackbar } from "@/lib/stores/actions/snackbar/snackbarActions";
import axiosInstance from "@/utils/axiosInstance";
import { Severity } from "@/lib/enums/Severity";
import StorageManager from "@/services/StorageManager";
import { Priority } from "@/lib/enums/priority.enum";
import { Fetch, rowsPerPage, StorageKeys } from "@/lib/helpers/constants/local.constant";
import { stockInformationFetchFailureMessage, stockInformationFilterOptions, stockInformationSearchPlaceholder, stockInformationTexts, DEFAULT_PAGE_NUMBER } from "./StockInformation.constant";
import { globalConstants } from "../../../lib/helpers/constants/global.constants";
import { StockInfo } from "./StockInformation.type";
import { FilterOptions, SelectedFilterType } from "@/lib/types/common.type";
import { SortColumn } from "@/lib/types/common.type";
import { CallingPortsType } from "./stockPlanning/StockPlanning.type";
import { Customer } from "@/lib/types/common.type";
import FilterChipsBar from "@/components/core/FilterChipsBar/FilterChipsBar";
import { getFormattedFileName } from "@/lib/helpers/converters/fileName/formatDownloadFileName";

dayjs.extend(customParseFormat);
dayjs.extend(advancedFormat);

const StockInformation: React.FC = () => {
  const userData = useSelector((state: RootState) => state.userDetails);
  const dispatch = useDispatch();
  const [stockData, setStockData] = useState<StockInfo[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(() => {
    const sessionCustomerId = StorageManager.getLocalData<Customer>(
      StorageKeys.Common.SELECTED_CUSTOMER
    )?.customerId;
    return sessionCustomerId != null ? String(sessionCustomerId) : null;
  });
  const [loading, setLoading] = useState({
    getAllStockInformation: true,
    getStockInformation: true,
    importClientStockInformation: false,
    fileDownload: false,
    initialLoading: true,
    filterOptions: false,
    submitStockPlanning: false,
    saveNote: false,
    callingPorts: false,
  });

  const [currentPage, setCurrentPage] = useState<number>(() => {
    const savedPage = StorageManager.getLocalData(StorageKeys.Stock.StockInformation.STOCK_INFO_PAGE);
    return savedPage ? Number(savedPage) : 1;
  });
  const [totalCount, setTotalCount] = useState<number>(0);
  const [pageSize, setPageSize] = useState(globalConstants.minRowsPerPage);
  const [popups, setPopups] = useState({
    editPopup: false,
    stockPlanning: false,
  });
  const [search, setSearch] = useState<string>(
    () =>
      StorageManager.getLocalData<string>(
        StorageKeys.Stock.StockInformation.STOCK_INFO_SEARCH
      ) || ""
  );
  const [searchSubmit, setSearchSubmit] = useState<boolean>(true);
  const [selectedFilters, setSelectedFilters] = useState<SelectedFilterType[]>(
    StorageManager.getLocalData<SelectedFilterType[]>(
      StorageKeys.Stock.StockInformation.STOCK_INFO
    ) || []
  );
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({} as FilterOptions);
  const [summaryCards, setSummaryCards] = useState({
    totalStockItems: 0,
    totalVolume: 0,
    totalWeight: 0,
  });
  const [sortModel, setSortModel] = useState<SortColumn[]>(() => {
    const savedSortModel = StorageManager.getLocalData<SortColumn[]>(
      StorageKeys.Stock.StockInformation.STOCK_INFO_SORT_MODEL
    );
    return savedSortModel || [];
  });
  const firstRender = useRef(true);
  const hasShownNoCustomerSnackbar = useRef(false);
  const [callingPorts, setCallingPorts] = useState<CallingPortsType[]>([]);
  const [selectedPortETA, setSelectedPortETA] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    setSearchSubmit(value === "");
    StorageManager.setLocalData(
      StorageKeys.Stock.StockInformation.STOCK_INFO_SEARCH,
      value
    );
  }, []);

  function isKeyboardEvent(e: React.KeyboardEvent<HTMLInputElement> | React.MouseEvent<HTMLInputElement | HTMLButtonElement>): e is React.KeyboardEvent<HTMLInputElement> {
    return (e as React.KeyboardEvent<HTMLInputElement>).key !== undefined;
  }

  const handleSearchOnBlurOrSubmit = useCallback(
    (
      e:
        | React.KeyboardEvent<HTMLInputElement>
        | React.MouseEvent<HTMLInputElement | HTMLButtonElement>
    ) => {
      if ((isKeyboardEvent(e) && e.key === "Enter") || e.type === "click") {
        setCurrentPage(1);
        setSearchSubmit(true);
        StorageManager.setLocalData(StorageKeys.Stock.StockInformation.STOCK_INFO_PAGE, DEFAULT_PAGE_NUMBER);
      }
    }, []);

  const handleSearchClear = useCallback(() => {
    setSearch("");
    setSearchSubmit(true);
    setCurrentPage(1);
    StorageManager.setLocalData(StorageKeys.Stock.StockInformation.STOCK_INFO_PAGE, DEFAULT_PAGE_NUMBER);
    StorageManager.setLocalData(StorageKeys.Stock.StockInformation.STOCK_INFO_SEARCH, "");
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    setSearchSubmit(true);
    StorageManager.setLocalData(StorageKeys.Stock.StockInformation.STOCK_INFO_PAGE, String(page));
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fetchCallingPorts = useCallback(
    async (vesselName: string) => {
      if (!userData.jwtToken || !vesselName) {
        return;
      }
      setCallingPorts([]);
      setLoading((prev) => ({ ...prev, callingPorts: true }));
      try {
        const res = await axiosInstance.get(
          Fetch.STOCK_INFORMATION.GET_VESSEL_CALLING_PORTS,
          {
            params: {
              vesselName,
            },
          }
        );
        setCallingPorts(res.data);
      } catch {
        setCallingPorts([]);
      } finally {
        setLoading((prev) => ({ ...prev, callingPorts: false }));
      }
    }, [userData.jwtToken]);

  const fetchStockData = useCallback(async () => {
    if (!userData.jwtToken || !searchSubmit) return;

    try {
      setSearchSubmit(false);
      setLoading((prev) => ({ ...prev, getStockInformation: true }));
      const body = {
        pageNumber: currentPage,
        searchTerm: search,
        pageSize,
        hubs:
          selectedFilters.find((f) => f.filterName === "Stock Location")
            ?.selectedOption || [],
        priorities:
          selectedFilters.find((f) => f.filterName === "Priority")
            ?.selectedOption || [],
        customerIds:
          selectedCustomerId
            ? [String(selectedCustomerId)]
            : (
              StorageManager.getLocalData<Customer>(StorageKeys.Common.SELECTED_CUSTOMER)?.customerId != null
                ? [String(StorageManager.getLocalData<Customer>(StorageKeys.Common.SELECTED_CUSTOMER)?.customerId)]
                : []
            ),
        sortColumns: sortModel.map((s) => s.columnKey),
        sortDirections: sortModel.map((s) => s.direction),
      };
      const response = await axiosInstance.post(Fetch.STOCK_INFORMATION.GET_STOCKS, body);
      if (response.status !== 200) {
        dispatch(
          showSnackbar({
            message: stockInformationFetchFailureMessage,
            severity: Severity.ERROR,
          })
        );
        return;
      }
      setTotalCount(response.data.pagedResponse.totalCount || 0);
      setStockData(response.data.pagedResponse.items || []);
      setSummaryCards({
        totalVolume: response.data?.totalVolume || 0,
        totalWeight: response.data?.totalWeight || 0,
        totalStockItems: response.data?.pagedResponse?.totalCount || 0,
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        dispatch(
          showSnackbar({
            message:
              error.response?.data?.message ||
              stockInformationFetchFailureMessage,
            severity: Severity.ERROR,
          })
        );
      }
      setStockData([]);
    } finally {
      setLoading((prev) => ({
        ...prev,
        getStockInformation: false,
        getAllStockInformation: false,
        initialLoading: false,
      }));
    }
  }, [userData.jwtToken, searchSubmit, selectedFilters, dispatch, currentPage, search, pageSize, selectedCustomerId, sortModel]);

  useEffect(() => {
    if (firstRender.current && sortModel.length > 0) {
      firstRender.current = false;
      return;
    } else {
      firstRender.current = false;
    }
    fetchStockData();
  }, [fetchStockData, sortModel]);

  useEffect(() => {
    if (!selectedCustomerId && userData.jwtToken) {
      const timeoutId = setTimeout(() => {
        if (!selectedCustomerId && !hasShownNoCustomerSnackbar.current) {
          hasShownNoCustomerSnackbar.current = true;
          dispatch(showSnackbar({ message: stockInformationTexts.SELECT_CUST_TO_VIEW, severity: Severity.WARNING }));
          setLoading(prev => ({ ...prev, initialLoading: false }));
        }
      }, 1500);

      return () => clearTimeout(timeoutId);
    }
  }, [selectedCustomerId, userData.jwtToken, dispatch]);

  const getFilterOptions = useCallback(async () => {
    if (!userData.jwtToken) return;
    if (!selectedCustomerId) {
      setLoading(prev => ({ ...prev, initialLoading: false }));
      return;
    }
    hasShownNoCustomerSnackbar.current = false;
    setLoading((prev) => ({ ...prev, filterOptions: true }));
    try {
      const stockFilterRes = await axiosInstance.get(Fetch.STOCK_INFORMATION.GET_FILTER_OPTIONS, {
        params: {
          customerId:
            selectedCustomerId
              ? Number(selectedCustomerId)
              : Number(StorageManager.getLocalData<Customer>(StorageKeys.Common.SELECTED_CUSTOMER)?.customerId)
        }
      });
      const responseData = stockFilterRes.data;

      setFilterOptions({
        "Stock Location": (responseData.sources ?? []).map((source: string) => ({
          label: source,
          value: source,
        })),
        Priority: (responseData.priorities ?? []).map(
          (priority: string) => ({ label: priority, value: priority })
        ),
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        dispatch(
          showSnackbar({
            message: stockInformationTexts.FAILED_TO_GET_FILTER_OPTIONS,
            severity: Severity.ERROR,
          })
        );
      }
    } finally {
      setLoading((prev) => ({
        ...prev,
        filterOptions: false,
      }));
    }
  }, [userData.jwtToken, dispatch, selectedCustomerId]);


  const handleStockInformationFileDownload = useCallback(async () => {
    if (!userData.jwtToken) return;
    setLoading(prev => ({ ...prev, fileDownload: true }));
    const selectedPriorityOptions =
      selectedFilters
        .find((f) => f.filterName === "Priority")
        ?.selectedOption.map((opt) => {
          if (opt === "-") return Priority.NONE;
          return Priority[opt as keyof typeof Priority];
        }) || [];

    const params: Record<string, string | number[]> = {};
    if (selectedPriorityOptions.length > 0) {
      params.priority = selectedPriorityOptions;
    }
    params.customerNo = selectedCustomerId || userData.CustomerId || '';
    try {
      const res = await axiosInstance.get(
        Fetch.STOCK_INFORMATION.DOWNLOAD_EXCEL,
        {
          responseType: 'blob',
          params,
          paramsSerializer: {
            indexes: null,
          },
          headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          }
        }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = getFormattedFileName(StorageKeys.Stock.StockInformation.STOCK_INFO);
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      dispatch(showSnackbar({ message: stockInformationTexts.FILE_DOWNLOAD_SUCCESS, severity: Severity.SUCCESS }));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        dispatch(showSnackbar({ message: stockInformationTexts.DOWNLOAD_FAIL, severity: Severity.ERROR }));
      }
    } finally {
      setLoading(prev => ({ ...prev, fileDownload: false }));
    }
  }, [userData.jwtToken, userData.CustomerId, selectedFilters, selectedCustomerId, dispatch]);


  useEffect(() => {
    document.title = StorageKeys.Stock.StockInformation.STOCK_INFO;
    if (userData.jwtToken && selectedCustomerId) {
      getFilterOptions();
    }
  }, [userData.jwtToken, selectedCustomerId, getFilterOptions]);

  const columns: TableColumn<StockInfo>[] = [
    { key: "vesselName", title: "Vessel Name", render: (value) => value || "-", sortable: true,maxWidth: 80, },
    { key: "purchaseOrderNumbers", title: "PO Number", render: (value) => value || "-", sortable: true, maxWidth: 70, },
    { key: "stockNumber", title: "Stock Number", render: (value) => value || "-", sortable: true, maxWidth: 70, },
    { key:"supplier" ,title:"Supplier Name",render:(value) => value || "-",sortable:true, maxWidth:80},
    {
      key: "priority",
      title: "Priority",
      render: (value, stock) => (
        <div
          className={`w-full flex items-center ${userData.jobTitle?.toLowerCase() === "admin" ? "justify-around" : ""
            }`}
        >
          <PriorityBadge priority={value || "-"} />
          {userData.jobTitle?.toLowerCase() === "admin" && (
            <button
              className="flex item-center justify-center cursor-pointer"
              onClick={() => {
                StorageManager.setSessionData(
                  StorageKeys.Stock.EDIT_SELECTED_STOCK_INFO,
                  stock
                );
                setPopups((prev) => ({ ...prev, editPopup: true }));
              }}
              type="button"
              title="Edit"
            >
              <span className="icon-ms-20 icon-ms-20-unfilled text-primary-green-700">
                edit_square
              </span>
            </button>
          )}
        </div>
      ),
      sortable: true, maxWidth: 55,
    },
    { key: "hub", title: "Stock Location", render: (value) => value || "-", sortable: true,maxWidth:80 },
    { key: "title", title: "Title", render: (value) => value || "-", sortable: true, maxWidth: 100 },
    { key: "status", title: "Status", render: (value) => <Status status={value?.toString() || ""} />, sortable: true, maxWidth: 70, },
    { key: "shipmentType", title: "Internal Shipment", render: (value) => (!value || value.toLowerCase() === 'unknown') ? '-' : value, sortable: true, maxWidth: 80 },
    { key: "items", title: "Packages", render: (value) => value || "-", sortable: true,maxWidth:50 },
    { key: "volume", title: "Volume (CBM)", render: (value) => value || "-", sortable: true, maxWidth:50},
    { key: "weight", title: "Weight (KG)", render: (value) => value || "-", sortable: true,maxWidth:50 },
    { key: "dimensions", title: "Dimensions (L*w*H)", render: (value) => value || "-", sortable: true, maxWidth:60 },
  ];

  const visibleColumns = String(selectedCustomerId ?? userData.CustomerId) === '66322'
    ? columns.filter(c => (c.title || '').toLowerCase() !== 'priority')
    : columns;

  const hidePriorityFilter = String(selectedCustomerId ?? userData.CustomerId) === '66322';
  const filterOptionsForBar: FilterOptions = hidePriorityFilter
    ? Object.fromEntries(Object.entries(filterOptions).filter(([k]) => k !== 'Priority')) as unknown as FilterOptions
    : filterOptions;
  const isPriorityItem = (item: Record<string, unknown>) =>
    ['filterName', 'name', 'label', 'title'].some((key) => (item?.[key] as string | undefined) === 'Priority');

  type StockInformationFilterOption = { label: string; value: string };
  const typedStockInformationFilterOptions = stockInformationFilterOptions as StockInformationFilterOption[];
  const mainFilterOptionsForBar = hidePriorityFilter
    ? typedStockInformationFilterOptions.filter((opt) => !isPriorityItem(opt))
    : typedStockInformationFilterOptions;

  const handleTableSort = useCallback((newSortColumns: SortColumn[]) => {
    setSortModel(newSortColumns);
    setSearchSubmit(true);
  }, []);

  useEffect(() => {
    StorageManager.setLocalData(
      StorageKeys.Stock.StockInformation.STOCK_INFO_SORT_MODEL,
      sortModel
    );
  }, [sortModel]);

  useEffect(() => {
    if (filterOptions && Object.keys(filterOptions).length > 0) {
      setSelectedFilters((prev) => {
        const prevMap = new Map(prev.map((f) => [f.filterName, f]));
        const next: SelectedFilterType[] = [];

        Object.entries(filterOptions).forEach(([key, options]) => {
          if (hidePriorityFilter && key === 'Priority') return;
          if (prevMap.has(key)) {
            const existing = prevMap.get(key)!;
            next.push({
              ...existing,
              filterOptions: options,
            });
          } else {
            next.push({
              filterName: key,
              filterDisplayName: key,
              searchInput: "",
              selectedOption: [] as string[],
              filterOptions: options,
            } as SelectedFilterType);
          }
        });

        StorageManager.setLocalData(
          StorageKeys.Stock.StockInformation.STOCK_INFO,
          next
        );
        return next;
      });
    }
  }, [filterOptions, hidePriorityFilter]);

  const handleSelectedCustomerIdChange = useCallback((customerId: string | null) => {
    setSelectedCustomerId((prev) => {
      if (prev !== customerId) {
        setLoading(prevLoad => ({ ...prevLoad, initialLoading: true, getAllStockInformation: true, getStockInformation: true }));
        setSelectedFilters((prevFilters) => {
          const shouldHide = String(customerId ?? userData.CustomerId) === '66322';
          return prevFilters
            .map((f) => ({ ...f, selectedOption: [] }))
            .filter((f) => !(shouldHide && f.filterName === 'Priority'));
        });
        setSearch("");
        StorageManager.setLocalData(StorageKeys.Stock.StockInformation.STOCK_INFO_SEARCH, "");
        setSearchSubmit(true);
      }
      return customerId;
    });
  }, [userData.CustomerId]);

  const saveNotes = useCallback(async (stockId: number, stockNumber: string) => {
    if (!userData.jwtToken) return;
    setLoading(prev => ({ ...prev, saveNote: true }));
    try {
      const body = {
        id: stockId,
        stockNumber,
        note: notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await axiosInstance.post(Fetch.STOCK_INFORMATION.SAVE_VESSEL_NOTES, body);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        dispatch(showSnackbar({ message: error.response?.data?.message || 'Failed to save note', severity: Severity.ERROR }));
      }
    } finally {
      setLoading(prev => ({ ...prev, saveNote: false }));
    }
  }, [userData.jwtToken, notes, dispatch]);

  const handleClosePopup = useCallback(() => {
    setPopups((prev) => ({ ...prev, stockPlanning: false }));
    setSelectedPortETA("");
    setNotes("");
    StorageManager.removeSessionData(StorageKeys.Stock.SELECTED_STOCK_INFO);
    StorageManager.removeSessionData(StorageKeys.Stock.STOCK_DATA);
  }, []);

  const handlePlanningSubmit = useCallback(async () => {
    const stockInformationData = StorageManager.getSessionData<StockInfo>(StorageKeys.Stock.SELECTED_STOCK_INFO);
    if ((!userData.jwtToken || !stockInformationData?.stockNumber)) {
      dispatch(showSnackbar({ message: "Please select a valid calling port.", severity: Severity.ERROR }));
      return;
    }
    setLoading(prev => ({ ...prev, submitStockPlanning: true }));
    try {
      const selectedPort = callingPorts.find(p => p.preferredPortETA === selectedPortETA);
      const body = {
        stockNumber: stockInformationData.stockNumber,
        preferredPort: selectedPort?.portName || '',
        preferredPortETA: selectedPortETA || '',
        priority: stockInformationData?.priority || '',
        service: stockInformationData.service || '',
        assignedBy: "Manual",
        plannedByUserId: userData.userId,
      };
      saveNotes(stockInformationData.stockId, stockInformationData.stockNumber);

      const res = await axiosInstance.post(Fetch.STOCK_INFORMATION.SAVE_STOCK_PLANNING, body);
      if (res.status === 200) {
        dispatch(showSnackbar({ message: res.data, severity: Severity.SUCCESS }));
        handleClosePopup();
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        dispatch(showSnackbar({ message: error.response?.data?.message || 'Failed to save planning', severity: Severity.ERROR }));
      }
    } finally {
      setLoading(prev => ({ ...prev, submitStockPlanning: false }));
      setSearchSubmit(true);
    }
  }, [userData.jwtToken, userData.userId, saveNotes, callingPorts, dispatch, selectedPortETA, handleClosePopup]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={stockInformationTexts.TITLE}
        description={stockInformationTexts.DESCRIPTION}
        onSelectedCustomerIdChange={handleSelectedCustomerIdChange}
      />

      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 me:grid-cols-3 w-full sm:w-auto mx-4 my-2 ${loading.initialLoading ? "translate-y-[-500%]" : "animate-header-slidedown"}`}>
        <SummaryCard title={stockInformationTexts.TOTAL_STOCK_ITEMS} value={summaryCards.totalStockItems} />
        <SummaryCard title={stockInformationTexts.TOTAL_WEIGHT} value={summaryCards.totalWeight} />
        <SummaryCard title={stockInformationTexts.TOTAL_VOLUME} value={summaryCards.totalVolume} />
      </div>

      <div className={`mx-4 my-2  ${loading.initialLoading ? 'translate-y-[-500%]' : 'animate-header-slidedown'}`}>
        <FilterChipsBar
          search={search}
          setSearch={setSearch}
          setSearchSubmit={setSearchSubmit}
          handleSearchOnBlurOrSubmit={handleSearchOnBlurOrSubmit}
          page={StorageKeys.Stock.StockInformation.STOCK_INFO}
          mainFilterOptions={mainFilterOptionsForBar}
          searchFilterPlaceholder={stockInformationSearchPlaceholder}
          handleSearchChange={handleSearchChange}
          handleSearchClear={handleSearchClear}
          selectedFilters={selectedFilters}
          setSelectedFilters={setSelectedFilters}
          filterOptions={filterOptionsForBar}
          columnsMeta={visibleColumns.map(({ key, title }) => ({ key, title }))}
          hideUploadDownload={hidePriorityFilter}
          showSourceTypeDropdown={true}
          searchKey={StorageKeys.Stock.StockInformation.STOCK_INFO_SEARCH}
          handleVesselScheduleFileDownload={handleStockInformationFileDownload}
          vesselScheduleIsLoading={loading}
          filterOptionsLoading={loading.filterOptions}
        />
      </div>

      {(loading.initialLoading || loading.saveNote || loading.submitStockPlanning) && <Loader />}

      <div
        className={`flex-1 min-h-0 flex flex-col bg-secondary-gray-100 ${loading.initialLoading
          ? "translate-y-[-200%]"
          : "animate-header-slidedown"
          } ${loading.getStockInformation ? "pointer-events-none" : ""}`}
      >
        <div className="flex-1 min-h-0 flex flex-col bg-white rounded-lg shadow-sm overflow-hidden">
          <DynamicTable
            columns={visibleColumns}
            data={stockData}
            rowKey={(row) => row.stockId}
            heightCalc={'flex-1 min-h-0'}
            onSort={handleTableSort}
            sortState={sortModel}
            isLoading={loading.getStockInformation}
            noDataMessage={stockInformationTexts.NO_DATA}
            title="Stock Information"
          />
        </div>
        <DataTablePagination
          rowsPerPage={rowsPerPage}
          rowCount={totalCount}
          currentPage={currentPage}
          onChangePage={handlePageChange}
          pageRows={pageSize}
          setPageRows={setPageSize}
        />
      </div>
      {popups.editPopup && (
        <EditStockInfoPopup
          onClose={() => {
            setPopups((prev) => ({ ...prev, editPopup: false }));
            StorageManager.removeSessionData(
              StorageKeys.Stock.EDIT_SELECTED_STOCK_INFO
            );
          }}
          fetchStockData={fetchStockData}
          setSearchSubmit={setSearchSubmit}
        />
      )}
      {popups.stockPlanning && (
        <StockPlanningPopup
          closePopup={handleClosePopup}
          stockDetails={
            StorageManager.getSessionData(
              StorageKeys.Stock.SELECTED_STOCK_INFO
            )!
          }
          selectedPortETA={selectedPortETA}
          setSelectedPortETA={setSelectedPortETA}
          callingPorts={callingPorts}
          callingPortsLoading={loading.callingPorts}
          handleSubmit={() => handlePlanningSubmit()}
          isStockPlanning
          notes={notes}
          setNotes={setNotes}
        />
      )}
    </div>
  );
};

export default StockInformation;
