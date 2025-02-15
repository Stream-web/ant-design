import classNames from 'classnames';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import type { ChangeEvent, CSSProperties } from 'react';
import type { ConfigConsumerProps, RenderEmptyHandler } from '../config-provider';
import { ConfigContext } from '../config-provider';
import defaultRenderEmpty from '../config-provider/defaultRenderEmpty';
import type { FormItemStatusContextProps } from '../form/context';
import { FormItemInputContext } from '../form/context';
import LocaleReceiver from '../locale/LocaleReceiver';
import defaultLocale from '../locale/en_US';
import type { InputStatus } from '../_util/statusUtils';
import { getMergedStatus, getStatusClassNames } from '../_util/statusUtils';
import { groupKeysMap, groupDisabledKeysMap } from '../_util/transKeys';
import warning from '../_util/warning';
import type { PaginationType } from './interface';
import type { TransferListProps } from './list';
import List from './list';
import type { TransferListBodyProps } from './ListBody';
import Operation from './operation';
import Search from './search';

import useStyle from './style';

export type { TransferListProps } from './list';
export type { TransferOperationProps } from './operation';
export type { TransferSearchProps } from './search';

export type TransferDirection = 'left' | 'right';

export interface RenderResultObject {
  label: React.ReactElement;
  value: string;
}

export type RenderResult = React.ReactElement | RenderResultObject | string | null;

export interface TransferItem {
  key?: string;
  title?: string;
  description?: string;
  disabled?: boolean;
  [name: string]: any;
}

export type KeyWise<T> = T & { key: string };

export type KeyWiseTransferItem = KeyWise<TransferItem>;

type TransferRender<RecordType> = (item: RecordType) => RenderResult;

export interface ListStyle {
  direction: TransferDirection;
}

export type SelectAllLabel =
  | React.ReactNode
  | ((info: { selectedCount: number; totalCount: number }) => React.ReactNode);

export interface TransferLocale {
  titles?: React.ReactNode[];
  notFoundContent?: React.ReactNode | React.ReactNode[];
  searchPlaceholder: string;
  itemUnit: string;
  itemsUnit: string;
  remove?: string;
  selectAll?: string;
  selectCurrent?: string;
  selectInvert?: string;
  removeAll?: string;
  removeCurrent?: string;
}

export interface TransferProps<RecordType> {
  prefixCls?: string;
  className?: string;
  disabled?: boolean;
  dataSource?: RecordType[];
  targetKeys?: string[];
  selectedKeys?: string[];
  render?: TransferRender<RecordType>;
  onChange?: (targetKeys: string[], direction: TransferDirection, moveKeys: string[]) => void;
  onSelectChange?: (sourceSelectedKeys: string[], targetSelectedKeys: string[]) => void;
  style?: React.CSSProperties;
  listStyle?: ((style: ListStyle) => CSSProperties) | CSSProperties;
  operationStyle?: CSSProperties;
  titles?: React.ReactNode[];
  operations?: string[];
  showSearch?: boolean;
  filterOption?: (inputValue: string, item: RecordType) => boolean;
  locale?: Partial<TransferLocale>;
  footer?: (
    props: TransferListProps<RecordType>,
    info?: { direction: TransferDirection },
  ) => React.ReactNode;
  rowKey?: (record: RecordType) => string;
  onSearch?: (direction: TransferDirection, value: string) => void;
  onScroll?: (direction: TransferDirection, e: React.SyntheticEvent<HTMLUListElement>) => void;
  children?: (props: TransferListBodyProps<RecordType>) => React.ReactNode;
  showSelectAll?: boolean;
  selectAllLabels?: SelectAllLabel[];
  oneWay?: boolean;
  pagination?: PaginationType;
  status?: InputStatus;
}

interface TransferFCProps {
  prefixCls: string;
  className: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

const TransferFC: React.FC<TransferFCProps> = (props) => {
  const { prefixCls, className, style, children } = props;
  const [wrapSSR, hashId] = useStyle(prefixCls);
  return wrapSSR(
    <div className={classNames(className, hashId)} style={style}>
      {children}
    </div>,
  );
};

const Transfer = <RecordType extends TransferItem = TransferItem>(
  props: TransferProps<RecordType>,
) => {
  const {
    dataSource = [],
    targetKeys = [],
    selectedKeys = [],
    selectAllLabels = [],
    operations = [],
    style = {},
    listStyle = {},
    locale = {},
    titles,
    className,
    disabled,
    showSearch = false,
    operationStyle,
    showSelectAll,
    oneWay,
    pagination,
    status: customStatus,
    prefixCls: customizePrefixCls,
    filterOption,
    render,
    footer,
    children,
    rowKey,
    onScroll,
    onChange,
    onSearch,
    onSelectChange,
  } = props;

  const [sourceSelectedKeys, setSourceSelectedKeys] = useState<string[]>(
    selectedKeys.filter((key) => !targetKeys.includes(key)),
  );

  const [targetSelectedKeys, setTargetSelectedKeys] = useState<string[]>(
    selectedKeys.filter((key) => targetKeys.includes(key)),
  );

  useEffect(() => {
    if (props.selectedKeys) {
      setSourceSelectedKeys(() => selectedKeys.filter((key) => !targetKeys.includes(key)));
      setTargetSelectedKeys(() => selectedKeys.filter((key) => targetKeys.includes(key)));
    }
  }, [props.selectedKeys, props.targetKeys]);

  if (process.env.NODE_ENV !== 'production') {
    warning(
      !pagination || !children,
      'Transfer',
      '`pagination` not support customize render list.',
    );
  }

  const setStateKeys = useCallback(
    (direction: TransferDirection, keys: string[] | ((prevKeys: string[]) => string[])) => {
      if (direction === 'left') {
        setSourceSelectedKeys((prev) => (typeof keys === 'function' ? keys(prev || []) : keys));
      } else {
        setTargetSelectedKeys((prev) => (typeof keys === 'function' ? keys(prev || []) : keys));
      }
    },
    [sourceSelectedKeys, targetSelectedKeys],
  );

  const handleSelectChange = useCallback(
    (direction: TransferDirection, holder: string[]) => {
      if (direction === 'left') {
        onSelectChange?.(holder, targetSelectedKeys);
      } else {
        onSelectChange?.(sourceSelectedKeys, holder);
      }
    },
    [sourceSelectedKeys, targetSelectedKeys],
  );

  const getTitles = (transferLocale: TransferLocale): React.ReactNode[] =>
    titles ?? transferLocale.titles ?? [];

  const getLocale = (transferLocale: TransferLocale, renderEmpty: RenderEmptyHandler) => ({
    ...transferLocale,
    notFoundContent: renderEmpty('Transfer'),
    ...locale,
  });

  const handleLeftScroll = (e: React.SyntheticEvent<HTMLUListElement>) => {
    onScroll?.('left', e);
  };

  const handleRightScroll = (e: React.SyntheticEvent<HTMLUListElement>) => {
    onScroll?.('right', e);
  };

  const moveTo = (direction: TransferDirection) => {
    const moveKeys = direction === 'right' ? sourceSelectedKeys : targetSelectedKeys;
    const dataSourceDisabledKeysMap = groupDisabledKeysMap(dataSource);
    // filter the disabled options
    const newMoveKeys = moveKeys.filter((key) => !dataSourceDisabledKeysMap.has(key));
    const newMoveKeysMap = groupKeysMap(newMoveKeys);
    // move items to target box
    const newTargetKeys =
      direction === 'right'
        ? newMoveKeys.concat(targetKeys)
        : targetKeys.filter((targetKey) => !newMoveKeysMap.has(targetKey));

    // empty checked keys
    const oppositeDirection = direction === 'right' ? 'left' : 'right';
    setStateKeys(oppositeDirection, []);
    handleSelectChange(oppositeDirection, []);
    onChange?.(newTargetKeys, direction, newMoveKeys);
  };

  const moveToLeft = () => {
    moveTo('left');
  };

  const moveToRight = () => {
    moveTo('right');
  };

  const onItemSelectAll = (direction: TransferDirection, keys: string[], checkAll: boolean) => {
    setStateKeys(direction, (prevKeys) => {
      let mergedCheckedKeys: string[] = [];
      if (checkAll) {
        // Merge current keys with origin key
        mergedCheckedKeys = Array.from(new Set<string>([...prevKeys, ...keys]));
      } else {
        const selectedKeysMap = groupKeysMap(keys);
        // Remove current keys from origin keys
        mergedCheckedKeys = prevKeys.filter((key) => !selectedKeysMap.has(key));
      }
      handleSelectChange(direction, mergedCheckedKeys);
      return mergedCheckedKeys;
    });
  };

  const onLeftItemSelectAll = (keys: string[], checkAll: boolean) => {
    onItemSelectAll('left', keys, checkAll);
  };

  const onRightItemSelectAll = (keys: string[], checkAll: boolean) => {
    onItemSelectAll('right', keys, checkAll);
  };

  const leftFilter = (e: ChangeEvent<HTMLInputElement>) => onSearch?.('left', e.target.value);

  const rightFilter = (e: ChangeEvent<HTMLInputElement>) => onSearch?.('right', e.target.value);

  const handleLeftClear = () => onSearch?.('left', '');

  const handleRightClear = () => onSearch?.('right', '');

  const onItemSelect = (direction: TransferDirection, selectedKey: string, checked: boolean) => {
    const holder = [...(direction === 'left' ? sourceSelectedKeys : targetSelectedKeys)];
    const index = holder.indexOf(selectedKey);
    if (index > -1) {
      holder.splice(index, 1);
    }
    if (checked) {
      holder.push(selectedKey);
    }
    handleSelectChange(direction, holder);
    if (!props.selectedKeys) {
      setStateKeys(direction, holder);
    }
  };

  const onLeftItemSelect = (selectedKey: string, checked: boolean) => {
    onItemSelect('left', selectedKey, checked);
  };

  const onRightItemSelect = (selectedKey: string, checked: boolean) => {
    onItemSelect('right', selectedKey, checked);
  };

  const onRightItemRemove = (keys: string[]) => {
    setStateKeys('right', []);
    onChange?.(
      targetKeys.filter((key) => !keys.includes(key)),
      'left',
      [...keys],
    );
  };

  const handleListStyle = (
    listStyles: TransferProps<RecordType>['listStyle'],
    direction: TransferDirection,
  ): CSSProperties => {
    if (typeof listStyles === 'function') {
      return listStyles({ direction });
    }
    return listStyles || {};
  };

  const separateDataSource = () => {
    const leftDataSource: KeyWise<RecordType>[] = [];
    const rightDataSource: KeyWise<RecordType>[] = new Array(targetKeys.length);
    const targetKeysMap = groupKeysMap(targetKeys);
    dataSource.forEach((record: KeyWise<RecordType>) => {
      if (rowKey) {
        record = { ...record, key: rowKey(record) };
      }
      // rightDataSource should be ordered by targetKeys
      // leftDataSource should be ordered by dataSource
      if (targetKeysMap.has(record.key)) {
        rightDataSource[targetKeysMap.get(record.key)!] = record;
      } else {
        leftDataSource.push(record);
      }
    });
    return { leftDataSource, rightDataSource };
  };

  const configContext = useContext<ConfigConsumerProps>(ConfigContext);
  const formItemContext = useContext<FormItemStatusContextProps>(FormItemInputContext);

  const { getPrefixCls, renderEmpty, direction } = configContext;
  const { hasFeedback, status } = formItemContext;

  const prefixCls = getPrefixCls('transfer', customizePrefixCls);
  const mergedStatus = getMergedStatus(status, customStatus);
  const mergedPagination = !children && pagination;

  const { leftDataSource, rightDataSource } = separateDataSource();

  const leftActive = targetSelectedKeys.length > 0;
  const rightActive = sourceSelectedKeys.length > 0;

  const cls = classNames(
    prefixCls,
    {
      [`${prefixCls}-disabled`]: disabled,
      [`${prefixCls}-customize-list`]: !!children,
      [`${prefixCls}-rtl`]: direction === 'rtl',
    },
    getStatusClassNames(prefixCls, mergedStatus, hasFeedback),
    className,
  );

  return (
    <LocaleReceiver componentName="Transfer" defaultLocale={defaultLocale.Transfer}>
      {(contextLocale) => {
        const listLocale = getLocale(contextLocale, renderEmpty || defaultRenderEmpty);
        const [leftTitle, rightTitle] = getTitles(listLocale);
        return (
          <TransferFC prefixCls={prefixCls} className={cls} style={style}>
            <List<KeyWise<RecordType>>
              prefixCls={`${prefixCls}-list`}
              titleText={leftTitle}
              dataSource={leftDataSource}
              filterOption={filterOption}
              style={handleListStyle(listStyle, 'left')}
              checkedKeys={sourceSelectedKeys}
              handleFilter={leftFilter}
              handleClear={handleLeftClear}
              onItemSelect={onLeftItemSelect}
              onItemSelectAll={onLeftItemSelectAll}
              render={render}
              showSearch={showSearch}
              renderList={children}
              footer={footer}
              onScroll={handleLeftScroll}
              disabled={disabled}
              direction={direction === 'rtl' ? 'right' : 'left'}
              showSelectAll={showSelectAll}
              selectAllLabel={selectAllLabels[0]}
              pagination={mergedPagination}
              {...listLocale}
            />
            <Operation
              className={`${prefixCls}-operation`}
              rightActive={rightActive}
              rightArrowText={operations[0]}
              moveToRight={moveToRight}
              leftActive={leftActive}
              leftArrowText={operations[1]}
              moveToLeft={moveToLeft}
              style={operationStyle}
              disabled={disabled}
              direction={direction}
              oneWay={oneWay}
            />
            <List<KeyWise<RecordType>>
              prefixCls={`${prefixCls}-list`}
              titleText={rightTitle}
              dataSource={rightDataSource}
              filterOption={filterOption}
              style={handleListStyle(listStyle, 'right')}
              checkedKeys={targetSelectedKeys}
              handleFilter={rightFilter}
              handleClear={handleRightClear}
              onItemSelect={onRightItemSelect}
              onItemSelectAll={onRightItemSelectAll}
              onItemRemove={onRightItemRemove}
              render={render}
              showSearch={showSearch}
              renderList={children}
              footer={footer}
              onScroll={handleRightScroll}
              disabled={disabled}
              direction={direction === 'rtl' ? 'left' : 'right'}
              showSelectAll={showSelectAll}
              selectAllLabel={selectAllLabels[1]}
              showRemove={oneWay}
              pagination={mergedPagination}
              {...listLocale}
            />
          </TransferFC>
        );
      }}
    </LocaleReceiver>
  );
};

if (process.env.NODE_ENV !== 'production') {
  Transfer.displayName = 'Transfer';
}

Transfer.List = List;
Transfer.Search = Search;
Transfer.Operation = Operation;

export default Transfer;
