import React, { useState, useEffect } from "react";

import { useDispatch } from "react-redux";
import {
	getData,
	getDataSucceeded,
} from "@strapi/admin/admin/src/content-manager/pages/ListView/actions";

import axiosInstance from "../../utils/axiosInstance";

import { SortableContainer, SortableElement } from "react-sortable-hoc";

import { SimpleMenu, MenuItem } from "@strapi/design-system/SimpleMenu";
import { IconButton } from "@strapi/design-system/IconButton";
import { Icon } from "@strapi/design-system/Icon";
import Drag from "@strapi/icons/Drag";
import Layer from "@strapi/icons/Layer";
import { arrayMoveImmutable } from "array-move";

import { useQueryParams } from "../../utils/useQueryParams";

const DEFAULT_SORT_MENU_PAGE_SIZE = 10;

const SortModal = () => {
	const [active, setActive] = useState(false);
	const [data, setData] = useState([]);
	const [currentPage, setCurrentPage] = useState(1);
	const [pageSize, setPageSize] = useState(DEFAULT_SORT_MENU_PAGE_SIZE);
	const [pagination, setPagination] = useState();
	const [status, setStatus] = useState("loading");
	const [settings, setSettings] = useState();

	// TODO: Refactor get queryParams to hook
	const [params] = useQueryParams();

	const dispatch = useDispatch();

	const refetchEntries = React.useCallback(
		() => dispatch(getData()),
		[dispatch]
	);

	const refetchEntriesSucceeded = React.useCallback(
		(pagination, newData) =>
			dispatch(getDataSucceeded(pagination, newData)),
		[dispatch, pagination, data]
	);

	// Shorten string to prevent line break
	const shortenString = (string) => {
		if (string.length > 40) {
			return string.substring(0, 37) + "...";
		}
		return string;
	};

	// Fetch settings from configuration
	const fetchSettings = async () => {
		try {
			const { data } = await axiosInstance.get(
				`/drag-drop-content-types/settings`
			);
			setSettings(data.body);
		} catch (e) {
			console.log(e);
		}
	};

	// Check database if the desired fields are available
	// TODO: check field integrity
	const initializeContentType = async () => {
		try {
			if (settings) {
				const { data } = await axiosInstance.get(
					`/content-manager/collection-types/${contentTypePath}?sort=rank:asc&page=${currentPage}&pageSize=${pageSize}&locale=${locale}`
				);
				if (
					data.results.length > 0 &&
					!!toString(data.results[0][settings.rank]) &&
					!!data.results[0][settings.title]
				) {
					setActive(true);
				}
			}
		} catch (e) {
			console.log(e);
			setStatus("error");
		}
	};

	// Fetch data from the database via get request
	const fetchContentType = async () => {
		try {
			const { data } = await axiosInstance.get(
				`/content-manager/collection-types/${contentTypePath}?sort=rank:asc&page=${currentPage}&pageSize=${pageSize}&locale=${locale}`
			);
			setStatus("success");
			setData(data.results);
			setPagination(data.pagination);
		} catch (e) {
			console.log(e);
			setStatus("error");
		}
	};

	// Update all ranks via put request.
	const updateContentType = async ({ oldIndex, newIndex }) => {
		try {
			// Increase performance by breaking loop after last element having a rank change is updated
			const sortedList = arrayMoveImmutable(data, oldIndex, newIndex);
			let rankHasChanged = false;
			// Iterate over all results and append them to the list
			for (let i = 0; i < pageSize; i++) {
				// Only update changed values
				if (sortedList[i].id != data[i].id) {
					const newRank =
						parseInt(pageSize * (currentPage - 1) + i) || 0;
					// Update rank via put request
					await axiosInstance.put(
						`/drag-drop-content-types/sort-update/${sortedList[i].id}`,
						{
							contentType: contentTypePath,
							rank: newRank,
						}
					);
					rankHasChanged = true;
				} else if (rankHasChanged) {
					break;
				}
			}

			//set new sorted data (refresh UI list component)
			setData(sortedList);
			setStatus("success");
			afterUpdate(pagination, sortedList);
		} catch (e) {
			console.log(e);
			setStatus("error");
		}
	};

	// Actions to perform after sorting is successful
	const afterUpdate = (pagination, newData) => {
		// Avoid full page reload and only re-render table.
		refetchEntries();
		refetchEntriesSucceeded(pagination, newData);
	};

	// Render the menu
	const showMenu = () => {
		const SortableItem = SortableElement(({ value }) => (
			<MenuItem style={{ zIndex: 10, cursor: "all-scroll" }}>
				<Icon height={"0.6rem"} as={Drag} />
				&nbsp;
				<span title={value[settings.title]}>
					{shortenString(value[settings.title])}
				</span>
			</MenuItem>
		));

		const SortableList = SortableContainer(({ items }) => {
			return (
				<ul>
					{items.map((value, index) => (
						<SortableItem
							key={`item-${value.id}`}
							index={index}
							value={value}
						/>
					))}
				</ul>
			);
		});
		return (
			<>
				<SimpleMenu
					as={IconButton}
					icon={<Layer />}
					onClick={() => {
						fetchContentType();
					}}
				>
					<SortableList items={data} onSortEnd={updateContentType} />
				</SimpleMenu>
			</>
		);
	};

	// Fetch settings on page render
	useEffect(() => {
		fetchSettings();
	}, []);

	// Update view when settings change
	useEffect(() => {
		initializeContentType();
	}, [settings]);

	// Sync entries in sort menu to match current page of ListView when content-manager page changes
	useEffect(() => {
		if (params?.page) {
			const page = parseInt(params.page);
			const pageSize = parseInt(params.pageSize);

			setCurrentPage(page);
			setPageSize(pageSize);
		}
	}, [params?.page, params?.pageSize]);

	// Get content type from url
	const paths = window.location.pathname.split("/");
	const queryParams = new URLSearchParams(window.location.search);
	const contentTypePath = paths[paths.length - 1];
	const locale = queryParams.get("plugins[i18n][locale]");

	return <>{showMenu()}</>;
};

export default SortModal;
